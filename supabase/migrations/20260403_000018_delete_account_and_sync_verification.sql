-- ============================================================
-- 20260403_000018_delete_account_and_sync_verification.sql
-- 1. sync_user_verification: Synchronize email confirmation from auth.users to public.profiles
-- 2. delete_user_account: Permanently delete profile, presence, and comments
-- ============================================================

-- 1. Function to check auth.users and sync confirmed status to public.profiles
CREATE OR REPLACE FUNCTION public.sync_user_verification(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirmed boolean := false;
  v_user_id uuid;
  v_clean_email text;
  v_profile jsonb;
BEGIN
  v_clean_email := lower(trim(COALESCE(p_email, '')));
  IF v_clean_email = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Email is empty');
  END IF;

  SELECT id, (email_confirmed_at IS NOT NULL) INTO v_user_id, v_confirmed
  FROM auth.users
  WHERE lower(email) = v_clean_email;

  IF v_user_id IS NOT NULL AND v_confirmed THEN
    UPDATE public.profiles
    SET email_verified = true,
        verification_required = false,
        updated_at = timezone('utc', now())
    WHERE auth_user_id = v_user_id OR lower(email) = v_clean_email;

    SELECT row_to_json(p)::jsonb INTO v_profile
    FROM public.public_profiles p
    WHERE p.auth_user_id = v_user_id OR lower(p.email) = v_clean_email;

    RETURN jsonb_build_object('ok', true, 'verified', true, 'profile', v_profile);
  END IF;

  RETURN jsonb_build_object('ok', true, 'verified', false);
END;
$$;

-- 2. Function to delete own profile and associated data
CREATE OR REPLACE FUNCTION public.delete_user_account(p_profile_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_profile_id IS NULL OR p_profile_id <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid profile ID');
  END IF;

  -- Delete presence
  DELETE FROM public.profile_presence WHERE profile_id = p_profile_id;

  -- Delete comments authored by or written on this profile
  DELETE FROM public.profile_comments WHERE author_profile_id = p_profile_id OR target_profile_id = p_profile_id;

  -- Delete profile
  DELETE FROM public.profiles WHERE profile_id = p_profile_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 3. Grants
GRANT EXECUTE ON FUNCTION public.sync_user_verification(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_user_account(bigint) TO anon, authenticated, service_role;
