-- ============================================================
-- 20260403_000019_name_and_login_monthly_cooldown.sql
-- Limit Display Name and Login changes to once per 30 days (1 month)
-- ============================================================

-- 1. Add timestamps for tracking last changes
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS login_updated_at timestamptz;

-- 2. Update public_profiles view
DROP VIEW IF EXISTS public.public_profiles CASCADE;

CREATE VIEW public.public_profiles AS
SELECT
  p.auth_user_id,
  coalesce(p.firebase_uid, p.auth_user_id::text) as firebase_uid,
  p.profile_id,
  p.email,
  p.email_verified,
  p.verification_required,
  p.login,
  p.display_name,
  p.photo_url,
  p.avatar_path,
  p.avatar_type,
  p.avatar_size,
  p.roles,
  p.is_banned,
  p.banned_at,
  p.subscription_until,
  p.has_claimed_trial,
  p.trial_claimed_at,
  p.is_frozen,
  p.frozen_at,
  p.last_frozen_at,
  p.frozen_remaining_ms,
  coalesce(p.activation_history, '[]'::jsonb) as activation_history,
  array[]::text[] as provider_ids,
  '[]'::jsonb as login_history,
  '[]'::jsonb as visit_history,
  p.created_at,
  p.last_sign_in_at,
  p.display_name_updated_at,
  p.login_updated_at
FROM public.profiles as p;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 3. Update public.update_profile_info with 30-day cooldown on display_name changes
CREATE OR REPLACE FUNCTION public.update_profile_info(
  p_profile_id bigint,
  p_display_name text DEFAULT NULL,
  p_photo_url text DEFAULT NULL
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
    SET photo_url = p_photo_url, updated_at = timezone('utc', now())
    WHERE profile_id = p_profile_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4. Update public.complete_google_profile with 30-day cooldown on login changes
CREATE OR REPLACE FUNCTION public.complete_google_profile(
  p_auth_user_id uuid,
  p_login text,
  p_display_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_login text;
  v_profile record;
  v_days_left integer;
  v_cooldown_interval interval := interval '30 days';
BEGIN
  v_clean_login := trim(COALESCE(p_login, ''));
  IF length(v_clean_login) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Логин должен быть от 3 символов.');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE auth_user_id = p_auth_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Профиль не найден.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(login) = lower(v_clean_login) AND profile_id <> v_profile.profile_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Этот логин уже занят.');
  END IF;

  -- Only check cooldown if changing an existing non-empty login to a different one
  IF v_profile.login IS NOT NULL AND v_profile.login <> '' AND lower(v_profile.login) <> lower(v_clean_login) THEN
    IF v_profile.login_updated_at IS NOT NULL AND v_profile.login_updated_at > (timezone('utc', now()) - v_cooldown_interval) THEN
      v_days_left := GREATEST(1, CEIL(EXTRACT(EPOCH FROM ((v_profile.login_updated_at + v_cooldown_interval) - timezone('utc', now()))) / 86400));
      RETURN jsonb_build_object(
        'ok', false,
        'error', format('Логин можно изменять только 1 раз в месяц (30 дней). Доступно через %s дн.', v_days_left),
        'days_left', v_days_left,
        'next_available_at', v_profile.login_updated_at + v_cooldown_interval
      );
    END IF;

    UPDATE public.profiles
    SET login = v_clean_login,
        login_updated_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    WHERE profile_id = v_profile.profile_id;
  ELSE
    -- Initial setup
    UPDATE public.profiles
    SET login = v_clean_login,
        updated_at = timezone('utc', now())
    WHERE profile_id = v_profile.profile_id;
  END IF;

  IF p_display_name IS NOT NULL AND trim(p_display_name) <> '' THEN
    UPDATE public.profiles
    SET display_name = trim(p_display_name),
        updated_at = timezone('utc', now())
    WHERE profile_id = v_profile.profile_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 5. Grant execute privileges
GRANT EXECUTE ON FUNCTION public.update_profile_info(bigint, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_google_profile(uuid, text, text) TO anon, authenticated, service_role;
