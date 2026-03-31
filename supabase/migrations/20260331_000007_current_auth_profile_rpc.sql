create or replace function public.get_current_auth_profile_rpc()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_auth_user_id uuid := auth.uid();
  target_profile record;
  target_presence record;
begin
  if actor_auth_user_id is null then
    return null;
  end if;

  select
    profile_id,
    auth_user_id,
    firebase_uid,
    email,
    email_verified,
    verification_required,
    verification_email_sent,
    login,
    display_name,
    photo_url,
    avatar_path,
    avatar_type,
    avatar_size,
    roles,
    is_banned,
    banned_at,
    provider_ids,
    login_history,
    visit_history,
    created_at,
    updated_at,
    last_sign_in_at
  into target_profile
  from public.profiles
  where auth_user_id = actor_auth_user_id
  limit 1;

  if target_profile.profile_id is null then
    return null;
  end if;

  select
    status,
    is_online,
    current_path,
    last_seen_at
  into target_presence
  from public.profile_presence
  where profile_id = target_profile.profile_id
  limit 1;

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
    'lastSignInTime', target_profile.last_sign_in_at,
    'presence', case
      when target_presence.status is null then null
      else jsonb_build_object(
        'status', target_presence.status,
        'isOnline', target_presence.is_online,
        'currentPath', target_presence.current_path,
        'lastSeenAt', target_presence.last_seen_at
      )
    end
  );
end;
$$;

grant execute on function public.get_current_auth_profile_rpc() to authenticated;
revoke all on function public.get_current_auth_profile_rpc() from anon;
