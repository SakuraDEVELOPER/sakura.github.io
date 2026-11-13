-- ============================================================
-- 20260403_000022_auto_renumber_uids_on_delete_and_banner_support.sql
-- 1. Add banner_url and banner_path to public.profiles
-- 2. Update public.public_profiles view
-- 3. Update update_profile_info to support banner fields
-- 4. Automatic renumbering trigger on public.profiles AFTER DELETE
-- 5. Updated admin_delete_profile function
-- ============================================================

-- 1. Banner columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_path text;

-- 2. Update public_profiles view
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles AS
SELECT 
    auth_user_id,
    COALESCE(firebase_uid, auth_user_id::text) AS firebase_uid,
    profile_id,
    email,
    email_verified,
    verification_required,
    login,
    display_name,
    photo_url,
    avatar_path,
    avatar_type,
    avatar_size,
    banner_url,
    banner_path,
    roles,
    is_banned,
    banned_at,
    subscription_until,
    has_claimed_trial,
    trial_claimed_at,
    is_frozen,
    frozen_at,
    last_frozen_at,
    frozen_remaining_ms,
    COALESCE(activation_history, '[]'::jsonb) AS activation_history,
    ARRAY[]::text[] AS provider_ids,
    '[]'::jsonb AS login_history,
    '[]'::jsonb AS visit_history,
    created_at,
    last_sign_in_at,
    display_name_updated_at,
    login_updated_at
FROM public.profiles p;

GRANT SELECT ON public.public_profiles TO anon, authenticated, service_role;

-- 3. Update update_profile_info to support banner fields
CREATE OR REPLACE FUNCTION public.update_profile_info(
  p_profile_id bigint,
  p_display_name text DEFAULT NULL,
  p_photo_url text DEFAULT NULL,
  p_banner_url text DEFAULT NULL,
  p_banner_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec record;
  v_next_display_name text;
  v_days_left integer;
  v_cooldown_interval interval := interval '30 days';
BEGIN
  SELECT * INTO v_rec FROM public.profiles WHERE profile_id = p_profile_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Профиль не найден.');
  END IF;

  v_next_display_name := NULLIF(trim(p_display_name), '');

  -- Check cooldown only if display name is actually being changed
  IF v_next_display_name IS NOT NULL AND (v_rec.display_name IS NULL OR lower(v_rec.display_name) <> lower(v_next_display_name)) THEN
    IF v_rec.display_name_updated_at IS NOT NULL AND v_rec.display_name_updated_at > (timezone('utc', now()) - v_cooldown_interval) THEN
      v_days_left := GREATEST(1, CEIL(EXTRACT(EPOCH FROM ((v_rec.display_name_updated_at + v_cooldown_interval) - timezone('utc', now()))) / 86400));
      RETURN jsonb_build_object(
        'ok', false,
        'error', format('Отображаемое имя можно изменять только 1 раз в месяц (30 дней). Доступно через %s дн.', v_days_left),
        'days_left', v_days_left,
        'next_available_at', v_rec.display_name_updated_at + v_cooldown_interval
      );
    END IF;

    UPDATE public.profiles
    SET
      display_name = v_next_display_name,
      display_name_updated_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
    WHERE profile_id = p_profile_id;
  END IF;

  IF p_photo_url IS NOT NULL THEN
    UPDATE public.profiles
    SET photo_url = NULLIF(trim(p_photo_url), ''), updated_at = timezone('utc', now())
    WHERE profile_id = p_profile_id;
  END IF;

  IF p_banner_url IS NOT NULL THEN
    UPDATE public.profiles
    SET 
      banner_url = NULLIF(trim(p_banner_url), ''), 
      banner_path = NULLIF(trim(p_banner_path), ''), 
      updated_at = timezone('utc', now())
    WHERE profile_id = p_profile_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4. Trigger for automatic UID shift-down on delete
CREATE OR REPLACE FUNCTION public.trg_auto_renumber_profiles_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_del_id bigint;
BEGIN
  v_del_id := OLD.profile_id;
  IF v_del_id IS NOT NULL AND v_del_id > 0 THEN
    -- Delete presence and comments belonging to deleted profile
    DELETE FROM public.profile_presence WHERE profile_id = v_del_id;
    DELETE FROM public.profile_comments WHERE profile_id = v_del_id OR author_profile_id = v_del_id;

    -- Shift down all subsequent profiles, presence, and comments
    FOR rec IN (
      SELECT profile_id 
      FROM public.profiles 
      WHERE profile_id > v_del_id 
      ORDER BY profile_id ASC
    ) LOOP
      -- Update presence first
      UPDATE public.profile_presence 
      SET profile_id = rec.profile_id - 1 
      WHERE profile_id = rec.profile_id;

      -- Update comments
      UPDATE public.profile_comments 
      SET profile_id = rec.profile_id - 1 
      WHERE profile_id = rec.profile_id;

      UPDATE public.profile_comments 
      SET author_profile_id = rec.profile_id - 1 
      WHERE author_profile_id = rec.profile_id;

      -- Update profile UID
      UPDATE public.profiles 
      SET profile_id = rec.profile_id - 1 
      WHERE profile_id = rec.profile_id;
    END LOOP;

    -- Reset sequence if exists
    BEGIN
      PERFORM setval('public.profile_id_seq', GREATEST(1, COALESCE((SELECT max(profile_id) FROM public.profiles), 1)), true);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_renumber_on_profile_delete ON public.profiles;
CREATE TRIGGER trg_renumber_on_profile_delete
  AFTER DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_renumber_profiles_on_delete();

-- 5. Updated admin_delete_profile
CREATE OR REPLACE FUNCTION public.admin_delete_profile(
  p_actor_profile_id bigint,
  p_target_profile_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id uuid;
BEGIN
  -- Verify actor has admin rights
  IF NOT public.is_profile_admin(p_actor_profile_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Доступ запрещён: требуются права администратора.');
  END IF;

  IF p_target_profile_id IS NULL OR p_target_profile_id <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Некорректный ID профиля.');
  END IF;

  -- Prevent deleting root by a non-root admin
  IF EXISTS (SELECT 1 FROM public.profiles WHERE profile_id = p_target_profile_id AND 'root' = ANY(roles)) THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE profile_id = p_actor_profile_id AND 'root' = ANY(roles)) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Нельзя удалить создателя (root).');
    END IF;
  END IF;

  SELECT auth_user_id INTO v_auth_user_id FROM public.profiles WHERE profile_id = p_target_profile_id;

  -- Deleting from profiles fires trg_renumber_on_profile_delete automatically!
  DELETE FROM public.profiles WHERE profile_id = p_target_profile_id;

  -- Delete from auth.users (frees the email and password account completely)
  IF v_auth_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_auth_user_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_profile(bigint, bigint) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_profile_info(bigint, text, text, text, text) TO anon, authenticated, service_role;
