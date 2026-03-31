create or replace view public.public_profile_comments as
select
  pc.id,
  pc.profile_id,
  pc.author_profile_id,
  null::uuid as auth_user_id,
  coalesce(pc.firebase_author_uid, pc.auth_user_id::text) as firebase_author_uid,
  pc.author_name,
  pc.author_photo_url,
  pc.author_accent_role,
  pc.message,
  pc.media_url,
  pc.media_type,
  pc.media_path,
  pc.media_size,
  pc.created_at,
  pc.updated_at
from public.profile_comments as pc;

grant select on public.public_profile_comments to anon, authenticated;

create or replace function public.add_profile_comment_rpc(
  target_profile_id bigint,
  target_message text default '',
  target_media_url text default null,
  target_media_type text default null,
  target_media_path text default null,
  target_media_size bigint default null
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
  created_comment public.profile_comments%rowtype;
  normalized_message text := left(trim(coalesce(target_message, '')), 280);
  normalized_media_url text := nullif(trim(coalesce(target_media_url, '')), '');
  normalized_media_type text := nullif(trim(coalesce(target_media_type, '')), '');
  normalized_media_path text := nullif(trim(coalesce(target_media_path, '')), '');
  resolved_author_name text;
  resolved_author_accent_role text;
begin
  if actor_auth_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if target_profile_id is null or target_profile_id <= 0 then
    raise exception 'Target profile not found.';
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

  if normalized_message = '' and normalized_media_url is null then
    raise exception 'Write a comment or attach media before sending.';
  end if;

  resolved_author_name := left(
    coalesce(
      nullif(trim(actor_profile.login), ''),
      nullif(trim(actor_profile.display_name), ''),
      nullif(split_part(coalesce(actor_profile.email, ''), '@', 1), ''),
      'Profile #' || actor_profile.profile_id::text
    ),
    48
  );
  resolved_author_accent_role := case
    when actor_profile.is_banned = true then 'banned'
    else coalesce(
      (
        select normalized_role
        from (
          select lower(trim(role)) as normalized_role
          from unnest(coalesce(actor_profile.roles, array[]::text[])) as role
        ) as roles
        where normalized_role <> ''
          and normalized_role <> 'subscriber'
        order by
          case normalized_role
            when 'banned' then 0
            when 'root' then 0
            when 'co-owner' then 1
            when 'super administrator' then 2
            when 'administrator' then 3
            when 'moderator' then 4
            when 'support' then 5
            when 'sponsor' then 6
            when 'tester' then 7
            when 'user' then 9
            else 99
          end,
          normalized_role asc
        limit 1
      ),
      'user'
    )
  end;

  insert into public.profile_comments (
    profile_id,
    author_profile_id,
    auth_user_id,
    firebase_author_uid,
    author_name,
    author_photo_url,
    author_accent_role,
    message,
    media_url,
    media_type,
    media_path,
    media_size
  )
  values (
    target_profile.profile_id,
    actor_profile.profile_id,
    actor_auth_user_id,
    nullif(trim(coalesce(actor_profile.firebase_uid, '')), ''),
    resolved_author_name,
    nullif(trim(coalesce(actor_profile.photo_url, '')), ''),
    resolved_author_accent_role,
    normalized_message,
    normalized_media_url,
    normalized_media_type,
    normalized_media_path,
    target_media_size
  )
  returning * into created_comment;

  return jsonb_build_object(
    'id', created_comment.id::text,
    'profileId', created_comment.profile_id,
    'authorUid', coalesce(created_comment.firebase_author_uid, created_comment.auth_user_id::text),
    'authorProfileId', created_comment.author_profile_id,
    'authorName', created_comment.author_name,
    'authorPhotoURL', created_comment.author_photo_url,
    'authorAccentRole', created_comment.author_accent_role,
    'message', created_comment.message,
    'mediaURL', created_comment.media_url,
    'mediaType', created_comment.media_type,
    'mediaPath', created_comment.media_path,
    'mediaSize', created_comment.media_size,
    'createdAt', created_comment.created_at,
    'updatedAt', created_comment.updated_at
  );
end;
$$;

create or replace function public.update_profile_comment_rpc(
  target_comment_id text,
  target_message text default '',
  target_media_url text default null,
  target_media_type text default null,
  target_media_path text default null,
  target_media_size bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_auth_user_id uuid := auth.uid();
  actor_profile public.profiles%rowtype;
  target_comment public.profile_comments%rowtype;
  target_author_profile public.profiles%rowtype;
  normalized_message text := left(trim(coalesce(target_message, '')), 280);
  normalized_media_url text := nullif(trim(coalesce(target_media_url, '')), '');
  normalized_media_type text := nullif(trim(coalesce(target_media_type, '')), '');
  normalized_media_path text := nullif(trim(coalesce(target_media_path, '')), '');
  normalized_comment_uuid uuid;
  actor_roles text[] := array[]::text[];
  actor_is_root boolean := false;
  actor_is_co_owner boolean := false;
  actor_is_author boolean := false;
begin
  if actor_auth_user_id is null then
    raise exception 'Authentication required.';
  end if;

  begin
    normalized_comment_uuid := nullif(trim(coalesce(target_comment_id, '')), '')::uuid;
  exception
    when others then
      raise exception 'Comment id is invalid.';
  end;

  select *
  into actor_profile
  from public.profiles
  where auth_user_id = actor_auth_user_id
  limit 1;

  if actor_profile.profile_id is null then
    raise exception 'Actor profile not found.';
  end if;

  select *
  into target_comment
  from public.profile_comments
  where id = normalized_comment_uuid
  limit 1;

  if target_comment.id is null then
    return null;
  end if;

  actor_roles := coalesce(actor_profile.roles, array[]::text[]);
  actor_is_root := coalesce('root' = any(actor_roles), false);
  actor_is_co_owner := coalesce('co-owner' = any(actor_roles), false);
  actor_is_author :=
    target_comment.author_profile_id = actor_profile.profile_id
    or target_comment.auth_user_id = actor_auth_user_id
    or (
      nullif(trim(coalesce(actor_profile.firebase_uid, '')), '') is not null
      and target_comment.firebase_author_uid = nullif(trim(coalesce(actor_profile.firebase_uid, '')), '')
    );

  if not actor_is_author and not actor_is_root and not actor_is_co_owner then
    raise exception 'Only the author, root, or co-owner can edit this comment.';
  end if;

  if normalized_message = '' and normalized_media_url is null then
    raise exception 'Write a comment or attach media before saving.';
  end if;

  update public.profile_comments
  set
    message = normalized_message,
    media_url = normalized_media_url,
    media_type = normalized_media_type,
    media_path = normalized_media_path,
    media_size = target_media_size,
    updated_at = timezone('utc', now())
  where id = target_comment.id
  returning * into target_comment;

  return jsonb_build_object(
    'id', target_comment.id::text,
    'profileId', target_comment.profile_id,
    'authorUid', coalesce(target_comment.firebase_author_uid, target_comment.auth_user_id::text),
    'authorProfileId', target_comment.author_profile_id,
    'authorName', target_comment.author_name,
    'authorPhotoURL', target_comment.author_photo_url,
    'authorAccentRole', target_comment.author_accent_role,
    'message', target_comment.message,
    'mediaURL', target_comment.media_url,
    'mediaType', target_comment.media_type,
    'mediaPath', target_comment.media_path,
    'mediaSize', target_comment.media_size,
    'createdAt', target_comment.created_at,
    'updatedAt', target_comment.updated_at
  );
end;
$$;

create or replace function public.delete_profile_comment_rpc(target_comment_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_auth_user_id uuid := auth.uid();
  actor_profile public.profiles%rowtype;
  target_comment public.profile_comments%rowtype;
  target_author_profile public.profiles%rowtype;
  normalized_comment_uuid uuid;
  actor_roles text[] := array[]::text[];
  actor_is_root boolean := false;
  actor_is_co_owner boolean := false;
  actor_can_moderate boolean := false;
  actor_is_author boolean := false;
  actor_owns_target_profile boolean := false;
  target_author_is_root boolean := false;
begin
  if actor_auth_user_id is null then
    raise exception 'Authentication required.';
  end if;

  begin
    normalized_comment_uuid := nullif(trim(coalesce(target_comment_id, '')), '')::uuid;
  exception
    when others then
      raise exception 'Comment id is invalid.';
  end;

  select *
  into actor_profile
  from public.profiles
  where auth_user_id = actor_auth_user_id
  limit 1;

  if actor_profile.profile_id is null then
    raise exception 'Actor profile not found.';
  end if;

  select *
  into target_comment
  from public.profile_comments
  where id = normalized_comment_uuid
  limit 1;

  if target_comment.id is null then
    return null;
  end if;

  if target_comment.author_profile_id is not null then
    select *
    into target_author_profile
    from public.profiles
    where profile_id = target_comment.author_profile_id
    limit 1;
  end if;

  actor_roles := coalesce(actor_profile.roles, array[]::text[]);
  actor_is_root := coalesce('root' = any(actor_roles), false);
  actor_is_co_owner := coalesce('co-owner' = any(actor_roles), false);
  actor_can_moderate := exists (
    select 1
    from unnest(actor_roles) as role
    where lower(trim(role)) in (
      'root',
      'co-owner',
      'super administrator',
      'administrator',
      'support',
      'moderator'
    )
  );
  actor_is_author :=
    target_comment.author_profile_id = actor_profile.profile_id
    or target_comment.auth_user_id = actor_auth_user_id
    or (
      nullif(trim(coalesce(actor_profile.firebase_uid, '')), '') is not null
      and target_comment.firebase_author_uid = nullif(trim(coalesce(actor_profile.firebase_uid, '')), '')
    );
  actor_owns_target_profile := target_comment.profile_id = actor_profile.profile_id;
  target_author_is_root :=
    coalesce('root' = any(coalesce(target_author_profile.roles, array[]::text[])), false)
    or lower(trim(coalesce(target_comment.author_accent_role, ''))) = 'root';

  if not actor_is_author and not actor_owns_target_profile and not actor_can_moderate then
    raise exception 'Only the author, profile owner, or comment moderator can delete this comment.';
  end if;

  if actor_is_co_owner and not actor_is_root and not actor_owns_target_profile and target_author_is_root then
    raise exception 'Co-owner cannot remove root comments outside the root profile.';
  end if;

  delete from public.profile_comments
  where id = target_comment.id;

  return jsonb_build_object(
    'id', target_comment.id::text
  );
end;
$$;

grant execute on function public.add_profile_comment_rpc(bigint, text, text, text, text, bigint) to authenticated;
grant execute on function public.update_profile_comment_rpc(text, text, text, text, text, bigint) to authenticated;
grant execute on function public.delete_profile_comment_rpc(text) to authenticated;
revoke all on function public.add_profile_comment_rpc(bigint, text, text, text, text, bigint) from anon;
revoke all on function public.update_profile_comment_rpc(text, text, text, text, text, bigint) from anon;
revoke all on function public.delete_profile_comment_rpc(text) from anon;
