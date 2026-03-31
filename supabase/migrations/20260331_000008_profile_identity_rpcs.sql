create or replace function public.update_current_profile_identity_rpc(
  target_login text default null,
  target_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_auth_user_id uuid := auth.uid();
  actor_profile public.profiles%rowtype;
  normalized_login_input text;
  sanitized_login text;
  sanitized_display_name text;
begin
  if actor_auth_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select *
  into actor_profile
  from public.profiles
  where auth_user_id = actor_auth_user_id
  limit 1;

  if actor_profile.profile_id is null then
    raise exception 'Actor profile not found.';
  end if;

  if target_login is not null then
    normalized_login_input := regexp_replace(trim(target_login), '\s+', '', 'g');

    if normalized_login_input = '' then
      raise exception 'Enter a login.';
    end if;

    sanitized_login := left(
      regexp_replace(normalized_login_input, '[^A-Za-zА-Яа-яЁё0-9._-]+', '', 'g'),
      24
    );

    if
      length(sanitized_login) < 3
      or sanitized_login <> normalized_login_input
    then
      raise exception 'Login must be 3-24 characters long and only contain letters, numbers, dots, underscores, or hyphens.';
    end if;

    if exists (
      select 1
      from public.profiles
      where login is not null
        and lower(login) = lower(sanitized_login)
        and profile_id <> actor_profile.profile_id
    ) then
      raise exception 'Login already in use.';
    end if;
  end if;

  if target_display_name is not null then
    sanitized_display_name := left(
      regexp_replace(trim(target_display_name), '\s+', ' ', 'g'),
      96
    );

    if sanitized_display_name = '' then
      raise exception 'Display name is required.';
    end if;
  end if;

  if sanitized_login is null and sanitized_display_name is null then
    raise exception 'No profile changes were provided.';
  end if;

  update public.profiles
  set
    login = coalesce(sanitized_login, login),
    display_name = coalesce(sanitized_display_name, display_name),
    updated_at = timezone('utc', now())
  where profile_id = actor_profile.profile_id
  returning * into actor_profile;

  return jsonb_build_object(
    'profileId', actor_profile.profile_id,
    'authUserId', actor_profile.auth_user_id,
    'firebaseUid', actor_profile.firebase_uid,
    'email', actor_profile.email,
    'emailVerified', actor_profile.email_verified,
    'verificationRequired', actor_profile.verification_required,
    'verificationEmailSent', actor_profile.verification_email_sent,
    'login', actor_profile.login,
    'displayName', actor_profile.display_name,
    'photoURL', actor_profile.photo_url,
    'avatarPath', actor_profile.avatar_path,
    'avatarType', actor_profile.avatar_type,
    'avatarSize', actor_profile.avatar_size,
    'roles', coalesce(actor_profile.roles, array[]::text[]),
    'isBanned', actor_profile.is_banned,
    'bannedAt', actor_profile.banned_at,
    'providerIds', coalesce(actor_profile.provider_ids, array[]::text[]),
    'loginHistory', coalesce(actor_profile.login_history, '[]'::jsonb),
    'visitHistory', coalesce(actor_profile.visit_history, '[]'::jsonb),
    'creationTime', actor_profile.created_at,
    'updatedAt', actor_profile.updated_at,
    'lastSignInTime', actor_profile.last_sign_in_at
  );
end;
$$;

create or replace function public.admin_update_profile_identity_rpc(
  target_profile_id bigint,
  target_login text default null,
  target_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_auth_user_id uuid := auth.uid();
  actor_profile public.profiles%rowtype;
  target_profile public.profiles%rowtype;
  actor_roles text[] := array[]::text[];
  target_roles text[] := array[]::text[];
  actor_is_root boolean := false;
  actor_is_co_owner boolean := false;
  target_is_root boolean := false;
  normalized_login_input text;
  sanitized_login text;
  sanitized_display_name text;
begin
  if actor_auth_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if target_profile_id is null or target_profile_id <= 0 then
    raise exception 'Target profile id is required.';
  end if;

  select *
  into actor_profile
  from public.profiles
  where auth_user_id = actor_auth_user_id
  limit 1;

  if actor_profile.profile_id is null then
    raise exception 'Actor profile not found.';
  end if;

  select *
  into target_profile
  from public.profiles
  where profile_id = target_profile_id
  limit 1;

  if target_profile.profile_id is null then
    raise exception 'Target profile not found.';
  end if;

  actor_roles := coalesce(actor_profile.roles, array[]::text[]);
  target_roles := coalesce(target_profile.roles, array[]::text[]);
  actor_is_root := coalesce('root' = any(actor_roles), false);
  actor_is_co_owner := coalesce('co-owner' = any(actor_roles), false);
  target_is_root := coalesce('root' = any(target_roles), false);

  if actor_profile.profile_id <> target_profile.profile_id then
    if not actor_is_root and not actor_is_co_owner then
      raise exception 'Only the owner or a manager can update profile fields.';
    end if;

    if actor_is_co_owner and not actor_is_root and target_is_root then
      raise exception 'Co-owner cannot manage a root account.';
    end if;
  end if;

  if target_login is not null then
    normalized_login_input := regexp_replace(trim(target_login), '\s+', '', 'g');

    if normalized_login_input = '' then
      raise exception 'Enter a login.';
    end if;

    sanitized_login := left(
      regexp_replace(normalized_login_input, '[^A-Za-zА-Яа-яЁё0-9._-]+', '', 'g'),
      24
    );

    if
      length(sanitized_login) < 3
      or sanitized_login <> normalized_login_input
    then
      raise exception 'Login must be 3-24 characters long and only contain letters, numbers, dots, underscores, or hyphens.';
    end if;

    if exists (
      select 1
      from public.profiles
      where login is not null
        and lower(login) = lower(sanitized_login)
        and profile_id <> target_profile.profile_id
    ) then
      raise exception 'Login already in use.';
    end if;
  end if;

  if target_display_name is not null then
    sanitized_display_name := left(
      regexp_replace(trim(target_display_name), '\s+', ' ', 'g'),
      96
    );

    if sanitized_display_name = '' then
      raise exception 'Display name is required.';
    end if;
  end if;

  if sanitized_login is null and sanitized_display_name is null then
    raise exception 'No profile changes were provided.';
  end if;

  update public.profiles
  set
    login = coalesce(sanitized_login, login),
    display_name = coalesce(sanitized_display_name, display_name),
    updated_at = timezone('utc', now())
  where profile_id = target_profile.profile_id
  returning * into target_profile;

  return jsonb_build_object(
    'profileId', target_profile.profile_id,
    'authUserId', target_profile.auth_user_id,
    'firebaseUid', target_profile.firebase_uid,
    'email', target_profile.email,
    'emailVerified', target_profile.email_verified,
    'verificationRequired', target_profile.verification_required,
    'verificationEmailSent', target_profile.verification_email_sent,
    'login', target_profile.login,
    'displayName', target_profile.display_name,
    'photoURL', target_profile.photo_url,
    'avatarPath', target_profile.avatar_path,
    'avatarType', target_profile.avatar_type,
    'avatarSize', target_profile.avatar_size,
    'roles', coalesce(target_profile.roles, array[]::text[]),
    'isBanned', target_profile.is_banned,
    'bannedAt', target_profile.banned_at,
    'providerIds', coalesce(target_profile.provider_ids, array[]::text[]),
    'loginHistory', coalesce(target_profile.login_history, '[]'::jsonb),
    'visitHistory', coalesce(target_profile.visit_history, '[]'::jsonb),
    'creationTime', target_profile.created_at,
    'updatedAt', target_profile.updated_at,
    'lastSignInTime', target_profile.last_sign_in_at
  );
end;
$$;

grant execute on function public.update_current_profile_identity_rpc(text, text) to authenticated;
grant execute on function public.admin_update_profile_identity_rpc(bigint, text, text) to authenticated;
revoke all on function public.update_current_profile_identity_rpc(text, text) from anon;
revoke all on function public.admin_update_profile_identity_rpc(bigint, text, text) from anon;
