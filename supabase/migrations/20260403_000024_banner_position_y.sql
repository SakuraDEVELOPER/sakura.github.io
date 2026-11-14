-- ============================================================
-- 20260403_000024_banner_position_y.sql
-- 1. Add banner_position_y column to public.profiles
-- 2. Update public.public_profiles view
-- 3. Drop previous 5-arg update_profile_info to prevent overloading
-- 4. Update update_profile_info with p_banner_position_y support
-- ============================================================

-- 1. Add column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_position_y integer DEFAULT 50;

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
    COALESCE(banner_position_y, 50) AS banner_position_y,
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
    login_updated_at,
    hwid,
    hwid_reset_at
FROM public.profiles p;

GRANT SELECT ON public.public_profiles TO anon, authenticated, service_role;

-- 3. Drop previous 5-arg update_profile_info
DROP FUNCTION IF EXISTS public.update_profile_info(bigint, text, text, text, text);

-- 4. Create updated update_profile_info with p_banner_position_y
CREATE OR REPLACE FUNCTION public.update_profile_info(
  p_profile_id bigint,
  p_display_name text DEFAULT NULL,
  p_photo_url text DEFAULT NULL,
  p_banner_url text DEFAULT NULL,
  p_banner_path text DEFAULT NULL,
  p_banner_position_y integer DEFAULT NULL
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

  IF p_banner_position_y IS NOT NULL THEN
    UPDATE public.profiles
    SET 
      banner_position_y = GREATEST(0, LEAST(100, p_banner_position_y)),
      updated_at = timezone('utc', now())
    WHERE profile_id = p_profile_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_profile_info(bigint, text, text, text, text, integer) TO anon, authenticated, service_role;
