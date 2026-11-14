-- ============================================================
-- 20260403_000023_hwid_monthly_self_reset.sql
-- 1. Add hwid_reset_at column to public.profiles
-- 2. Update public.public_profiles view
-- 3. Create reset_self_hwid RPC function with 30-day cooldown
-- ============================================================

-- 1. Add hwid_reset_at column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hwid_reset_at timestamptz DEFAULT NULL;

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
    login_updated_at,
    hwid,
    hwid_reset_at
FROM public.profiles p;

GRANT SELECT ON public.public_profiles TO anon, authenticated, service_role;

-- 3. Function to reset self HWID once per 30 days
CREATE OR REPLACE FUNCTION public.reset_self_hwid(p_profile_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec record;
  v_days_left integer;
  v_cooldown_interval interval := interval '30 days';
  v_now timestamptz := timezone('utc', now());
BEGIN
  IF p_profile_id IS NULL OR p_profile_id <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Некорректный ID профиля.');
  END IF;

  SELECT * INTO v_rec FROM public.profiles WHERE profile_id = p_profile_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Профиль не найден.');
  END IF;

  -- Check 30-day cooldown
  IF v_rec.hwid_reset_at IS NOT NULL AND v_rec.hwid_reset_at > (v_now - v_cooldown_interval) THEN
    v_days_left := GREATEST(1, CEIL(EXTRACT(EPOCH FROM ((v_rec.hwid_reset_at + v_cooldown_interval) - v_now)) / 86400));
    RETURN jsonb_build_object(
      'ok', false,
      'error', format('Сброс HWID доступен 1 раз в 30 дней. Доступно через %s дн.', v_days_left),
      'days_left', v_days_left,
      'next_available_at', v_rec.hwid_reset_at + v_cooldown_interval
    );
  END IF;

  -- Reset HWID and update timestamp
  UPDATE public.profiles
  SET 
    hwid = NULL,
    hwid_reset_at = v_now,
    updated_at = v_now
  WHERE profile_id = p_profile_id;

  RETURN jsonb_build_object(
    'ok', true,
    'hwid_reset_at', v_now,
    'message', 'HWID успешно сброшен.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_self_hwid(bigint) TO anon, authenticated, service_role;
