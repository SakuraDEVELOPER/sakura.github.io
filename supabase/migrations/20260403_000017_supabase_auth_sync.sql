-- ============================================================
-- 20260403_000017_supabase_auth_sync.sql
-- Native PostgreSQL Security Definer RPC functions for
-- Full Supabase Auth (Registration, Profile Linking, Google Auth, Presence)
-- ============================================================

-- 1. Register profile function
CREATE OR REPLACE FUNCTION public.register_profile(
  p_login text,
  p_display_name text,
  p_email text,
  p_auth_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clean_login text;
  v_clean_email text;
  v_clean_display text;
  v_new_profile public.profiles%ROWTYPE;
BEGIN
  v_clean_login := trim(COALESCE(p_login, ''));
  v_clean_email := lower(trim(COALESCE(p_email, '')));
  v_clean_display := trim(COALESCE(p_display_name, ''));
  IF v_clean_display = '' THEN
    v_clean_display := v_clean_login;
  END IF;

  IF length(v_clean_login) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Логин должен содержать минимум 3 символа.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(login) = lower(v_clean_login)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Этот логин уже занят.');
  END IF;

  IF v_clean_email <> '' AND EXISTS (SELECT 1 FROM public.profiles WHERE lower(email) = v_clean_email) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Этот email уже зарегистрирован.');
  END IF;

  INSERT INTO public.profiles (
    auth_user_id,
    login,
    display_name,
    email,
    email_verified,
    roles,
    is_banned,
    has_claimed_trial,
    is_frozen,
    created_at,
    updated_at,
    last_sign_in_at
  ) VALUES (
    p_auth_user_id,
    v_clean_login,
    v_clean_display,
    v_clean_email,
    false,
    ARRAY['user']::text[],
    false,
    false,
    false,
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  )
  RETURNING * INTO v_new_profile;

  RETURN jsonb_build_object(
    'ok', true,
    'profile_id', v_new_profile.profile_id,
    'login', v_new_profile.login,
    'display_name', v_new_profile.display_name,
    'email', v_new_profile.email
  );
END;
$$;

-- 2. Link / Get Profile by Supabase Auth user
CREATE OR REPLACE FUNCTION public.get_or_sync_auth_profile(
  p_auth_user_id uuid,
  p_email text,
  p_suggested_login text DEFAULT NULL,
  p_suggested_display_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile record;
  v_clean_email text;
  v_target_login text;
BEGIN
  v_clean_email := lower(trim(COALESCE(p_email, '')));

  -- Look up by auth_user_id first
  SELECT * INTO v_profile FROM public.profiles WHERE auth_user_id = p_auth_user_id;

  -- Look up by email if not found by auth_user_id
  IF NOT FOUND AND v_clean_email <> '' THEN
    SELECT * INTO v_profile FROM public.profiles WHERE lower(email) = v_clean_email;
    IF FOUND THEN
      UPDATE public.profiles
      SET auth_user_id = p_auth_user_id,
          last_sign_in_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
      WHERE profile_id = v_profile.profile_id;
    END IF;
  END IF;

  -- If still not found (e.g. brand new OAuth user like Google)
  IF v_profile.profile_id IS NULL THEN
    v_target_login := COALESCE(NULLIF(trim(p_suggested_login), ''), split_part(v_clean_email, '@', 1));
    -- Make sure login is unique
    IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(login) = lower(v_target_login)) THEN
      v_target_login := v_target_login || '_' || floor(random() * 9000 + 1000)::text;
    END IF;

    INSERT INTO public.profiles (
      auth_user_id,
      login,
      display_name,
      email,
      email_verified,
      roles,
      is_banned,
      has_claimed_trial,
      is_frozen,
      created_at,
      updated_at,
      last_sign_in_at
    ) VALUES (
      p_auth_user_id,
      v_target_login,
      COALESCE(NULLIF(trim(p_suggested_display_name), ''), v_target_login),
      v_clean_email,
      true,
      ARRAY['user']::text[],
      false,
      false,
      false,
      timezone('utc', now()),
      timezone('utc', now()),
      timezone('utc', now())
    )
    RETURNING * INTO v_profile;
  ELSE
    UPDATE public.profiles
    SET last_sign_in_at = timezone('utc', now())
    WHERE profile_id = v_profile.profile_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'profile', (
      SELECT row_to_json(p) FROM public.public_profiles p WHERE p.profile_id = v_profile.profile_id
    )
  );
END;
$$;

-- 3. Complete Google Account setup (choose login/password if needed)
CREATE OR REPLACE FUNCTION public.complete_google_profile(
  p_auth_user_id uuid,
  p_login text,
  p_display_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clean_login text;
  v_profile record;
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

  UPDATE public.profiles
  SET login = v_clean_login,
      display_name = COALESCE(NULLIF(trim(p_display_name), ''), v_clean_login),
      updated_at = timezone('utc', now())
  WHERE profile_id = v_profile.profile_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4. Heartbeat presence update
CREATE OR REPLACE FUNCTION public.touch_presence(
  p_profile_id bigint,
  p_path text,
  p_is_online boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profile_presence (
    profile_id,
    current_path,
    is_online,
    status,
    last_seen_at,
    updated_at
  ) VALUES (
    p_profile_id,
    p_path,
    p_is_online,
    CASE WHEN p_is_online THEN 'online' ELSE 'offline' END,
    timezone('utc', now()),
    timezone('utc', now())
  )
  ON CONFLICT (profile_id) DO UPDATE
  SET
    current_path = EXCLUDED.current_path,
    is_online = EXCLUDED.is_online,
    status = EXCLUDED.status,
    last_seen_at = EXCLUDED.last_seen_at,
    updated_at = EXCLUDED.updated_at;
END;
$$;

-- 5. Trigger on auth.users for automatic profile creation/sync on signup
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_login text;
  v_display_name text;
BEGIN
  v_login := COALESCE(new.raw_user_meta_data->>'login', split_part(new.email, '@', 1));
  v_display_name := COALESCE(new.raw_user_meta_data->>'display_name', v_login);

  IF EXISTS (SELECT 1 FROM public.profiles WHERE auth_user_id = new.id OR lower(email) = lower(new.email)) THEN
    UPDATE public.profiles
    SET auth_user_id = new.id,
        email = new.email,
        updated_at = timezone('utc', now())
    WHERE auth_user_id = new.id OR lower(email) = lower(new.email);
  ELSE
    INSERT INTO public.profiles (
      auth_user_id,
      email,
      email_verified,
      login,
      display_name,
      roles,
      created_at,
      updated_at
    ) VALUES (
      new.id,
      new.email,
      COALESCE(new.email_confirmed_at IS NOT NULL, false),
      v_login,
      v_display_name,
      ARRAY['user']::text[],
      timezone('utc', now()),
      timezone('utc', now())
    );
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_auth_user();

-- 6. Grant execute on RPC functions to anon, authenticated, service_role
GRANT EXECUTE ON FUNCTION public.register_profile(text, text, text, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_or_sync_auth_profile(uuid, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_google_profile(uuid, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.touch_presence(bigint, text, boolean) TO anon, authenticated, service_role;

-- 6.5. Update user profile info (display name, photo)
CREATE OR REPLACE FUNCTION public.update_profile_info(
  p_profile_id bigint,
  p_display_name text DEFAULT NULL,
  p_photo_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET
    display_name = COALESCE(NULLIF(trim(p_display_name), ''), display_name),
    photo_url = COALESCE(p_photo_url, photo_url),
    updated_at = timezone('utc', now())
  WHERE profile_id = p_profile_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_profile_info(bigint, text, text) TO anon, authenticated, service_role;

-- 7. Update public_profiles view exposing auth_user_id and email
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
  p.last_sign_in_at
FROM public.profiles as p;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

