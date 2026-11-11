-- ============================================================
-- 20260403_000016_full_supabase_functions.sql
-- Native PostgreSQL Security Definer RPC functions for
-- Full Supabase backend (Trials, Promos, Freezing, Admin, Comments)
-- ============================================================

-- 1. Helper function: check if profile is admin
CREATE OR REPLACE FUNCTION public.is_profile_admin(p_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_roles text[];
BEGIN
  IF p_id = 1 THEN
    RETURN true;
  END IF;
  SELECT roles INTO v_roles FROM public.profiles WHERE profile_id = p_id;
  IF v_roles IS NOT NULL AND v_roles && ARRAY['root', 'co-owner', 'owner', 'admin'] THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

-- 2. Claim free trial (7 days)
CREATE OR REPLACE FUNCTION public.claim_free_trial(p_profile_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile record;
  v_base_time timestamptz;
  v_new_until timestamptz;
  v_new_roles text[];
  v_history_item jsonb;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE profile_id = p_profile_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Профиль не найден.');
  END IF;

  IF v_profile.has_claimed_trial = true OR v_profile.trial_claimed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Бесплатный 7-дневный тест уже был активирован на этом аккаунте.');
  END IF;

  v_base_time := GREATEST(COALESCE(v_profile.subscription_until, timezone('utc', now())), timezone('utc', now()));
  v_new_until := v_base_time + interval '7 days';

  v_new_roles := COALESCE(v_profile.roles, ARRAY[]::text[]);
  IF NOT ('subscriber' = ANY(v_new_roles)) THEN
    v_new_roles := array_append(v_new_roles, 'subscriber');
  END IF;

  v_history_item := jsonb_build_object(
    'id', 'trial_' || (extract(epoch from timezone('utc', now())) * 1000)::bigint,
    'type', 'trial',
    'code', '7-DAYS-TRIAL',
    'durationDays', 7,
    'isLifetime', false,
    'activatedAt', to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'subscriptionUntil', to_char(v_new_until, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'note', 'Бесплатный тестовый период на 7 дней'
  );

  UPDATE public.profiles
  SET
    has_claimed_trial = true,
    trial_claimed_at = timezone('utc', now()),
    subscription_until = v_new_until,
    roles = v_new_roles,
    is_frozen = false,
    frozen_at = null,
    frozen_remaining_ms = 0,
    activation_history = jsonb_insert(COALESCE(activation_history, '[]'::jsonb), '{0}', v_history_item)
  WHERE profile_id = p_profile_id;

  RETURN jsonb_build_object(
    'ok', true,
    'durationDays', 7,
    'subscriptionUntil', to_char(v_new_until, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
END;
$$;

-- 3. Redeem promo code
CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code text, p_profile_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clean_code text;
  v_promo record;
  v_profile record;
  v_is_lifetime boolean;
  v_base_time timestamptz;
  v_new_until timestamptz;
  v_new_roles text[];
  v_history_item jsonb;
  v_used_by jsonb;
BEGIN
  v_clean_code := upper(trim(COALESCE(p_code, '')));
  IF v_clean_code = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Введите промокод.');
  END IF;

  SELECT * INTO v_promo FROM public.promo_codes WHERE upper(code) = v_clean_code FOR UPDATE;
  IF NOT FOUND OR v_promo.is_active = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Промокод не существует или не активен.');
  END IF;

  v_used_by := COALESCE(v_promo.used_by, '[]'::jsonb);
  IF v_used_by @> to_jsonb(p_profile_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Вы уже активировали этот промокод на своём аккаунте.');
  END IF;

  IF v_promo.max_uses > 0 AND COALESCE(v_promo.used_count, 0) >= v_promo.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Лимит активаций этого промокода исчерпан.');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE profile_id = p_profile_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Профиль не найден.');
  END IF;

  v_is_lifetime := (v_promo.duration_days >= 99999 OR lower(v_promo.role) = 'lifetime');

  v_new_roles := COALESCE(v_profile.roles, ARRAY[]::text[]);
  IF v_is_lifetime THEN
    v_new_until := '2999-12-31T22:01:00Z'::timestamptz;
    IF NOT ('lifetime' = ANY(v_new_roles)) THEN
      v_new_roles := array_append(v_new_roles, 'lifetime');
    END IF;
  ELSE
    v_base_time := GREATEST(COALESCE(v_profile.subscription_until, timezone('utc', now())), timezone('utc', now()));
    v_new_until := v_base_time + (v_promo.duration_days || ' days')::interval;
    IF NOT ('subscriber' = ANY(v_new_roles)) THEN
      v_new_roles := array_append(v_new_roles, 'subscriber');
    END IF;
  END IF;

  v_history_item := jsonb_build_object(
    'id', 'act_' || (extract(epoch from timezone('utc', now())) * 1000)::bigint,
    'type', 'promo',
    'code', v_clean_code,
    'durationDays', v_promo.duration_days,
    'isLifetime', v_is_lifetime,
    'activatedAt', to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'subscriptionUntil', to_char(v_new_until, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'note', COALESCE(v_promo.note, '')
  );

  -- Update promo_codes
  UPDATE public.promo_codes
  SET
    used_count = COALESCE(used_count, 0) + 1,
    used_by = v_used_by || to_jsonb(p_profile_id)
  WHERE code = v_promo.code;

  -- Update profile
  UPDATE public.profiles
  SET
    subscription_until = v_new_until,
    roles = v_new_roles,
    is_frozen = false,
    frozen_at = null,
    frozen_remaining_ms = 0,
    activation_history = jsonb_insert(COALESCE(activation_history, '[]'::jsonb), '{0}', v_history_item)
  WHERE profile_id = p_profile_id;

  RETURN jsonb_build_object(
    'ok', true,
    'durationDays', v_promo.duration_days,
    'isLifetime', v_is_lifetime,
    'subscriptionUntil', to_char(v_new_until, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
END;
$$;

-- 4. Toggle freeze / unfreeze subscription
CREATE OR REPLACE FUNCTION public.toggle_subscription_freeze(p_profile_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile record;
  v_roles text[];
  v_rem_ms bigint;
  v_new_until timestamptz;
  v_history_item jsonb;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE profile_id = p_profile_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Профиль не найден.');
  END IF;

  v_roles := COALESCE(v_profile.roles, ARRAY[]::text[]);

  IF v_profile.is_frozen = true THEN
    -- UNFREEZE
    v_rem_ms := COALESCE(v_profile.frozen_remaining_ms, 0);
    IF v_rem_ms <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Нет сохранённого времени для разморозки.');
    END IF;

    v_new_until := timezone('utc', now()) + (v_rem_ms || ' milliseconds')::interval;

    IF NOT ('subscriber' = ANY(v_roles)) THEN
      v_roles := array_append(v_roles, 'subscriber');
    END IF;

    v_history_item := jsonb_build_object(
      'id', 'unfreeze_' || (extract(epoch from timezone('utc', now())) * 1000)::bigint,
      'type', 'unfreeze',
      'activatedAt', to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'subscriptionUntil', to_char(v_new_until, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );

    UPDATE public.profiles
    SET
      is_frozen = false,
      frozen_at = null,
      frozen_remaining_ms = 0,
      subscription_until = v_new_until,
      roles = v_roles,
      activation_history = jsonb_insert(COALESCE(activation_history, '[]'::jsonb), '{0}', v_history_item)
    WHERE profile_id = p_profile_id;

    RETURN jsonb_build_object(
      'ok', true,
      'isFrozen', false,
      'subscriptionUntil', to_char(v_new_until, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );
  ELSE
    -- FREEZE
    IF v_roles && ARRAY['lifetime', 'root', 'owner', 'co-owner'] THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Бессрочную подписку (Lifetime) не требуется замораживать.');
    END IF;

    IF v_roles && ARRAY['test period', 'trial'] THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Тестовую подписку (7 Дней) нельзя заморозить.');
    END IF;

    IF v_profile.last_frozen_at IS NOT NULL AND v_profile.last_frozen_at + interval '30 days' > timezone('utc', now()) THEN
      DECLARE
        v_days_left int := CEIL(EXTRACT(EPOCH FROM ((v_profile.last_frozen_at + interval '30 days') - timezone('utc', now()))) / 86400.0);
      BEGIN
        RETURN jsonb_build_object('ok', false, 'error', 'Заморозка доступна только 1 раз в 30 дней. Следующая заморозка через ' || v_days_left || ' дн.');
      END;
    END IF;

    IF v_profile.subscription_until IS NULL OR v_profile.subscription_until <= timezone('utc', now()) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'У вас нет активной подписки для заморозки.');
    END IF;

    v_rem_ms := (EXTRACT(EPOCH FROM (v_profile.subscription_until - timezone('utc', now()))) * 1000)::bigint;
    IF v_rem_ms < 3600000 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Недостаточно времени для заморозки (минимум 1 час).');
    END IF;

    v_history_item := jsonb_build_object(
      'id', 'freeze_' || (extract(epoch from timezone('utc', now())) * 1000)::bigint,
      'type', 'freeze',
      'activatedAt', to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'remainingDays', round((v_rem_ms / 86400000.0)::numeric, 1)
    );

    UPDATE public.profiles
    SET
      is_frozen = true,
      frozen_at = timezone('utc', now()),
      last_frozen_at = timezone('utc', now()),
      frozen_remaining_ms = v_rem_ms,
      activation_history = jsonb_insert(COALESCE(activation_history, '[]'::jsonb), '{0}', v_history_item)
    WHERE profile_id = p_profile_id;

    RETURN jsonb_build_object(
      'ok', true,
      'isFrozen', true,
      'frozenRemainingMs', v_rem_ms
    );
  END IF;
END;
$$;

-- 5. Admin Promo Code Management (List, Create, Delete)
CREATE OR REPLACE FUNCTION public.admin_manage_promo(
  p_action text,
  p_actor_id bigint,
  p_code text DEFAULT NULL,
  p_duration int DEFAULT 30,
  p_role text DEFAULT 'subscriber',
  p_max_uses int DEFAULT 1,
  p_note text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clean_code text;
BEGIN
  IF NOT public.is_profile_admin(p_actor_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Только Root, Owner и Co-owner могут управлять промокодами.');
  END IF;

  IF p_action = 'list' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'promos', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', code,
            'code', code,
            'durationDays', duration_days,
            'role', role,
            'isActive', is_active,
            'maxUses', max_uses,
            'usedCount', used_count,
            'usedBy', used_by,
            'note', note,
            'createdBy', created_by,
            'createdAt', to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          ) ORDER BY created_at DESC
        ) FROM public.promo_codes
      ), '[]'::jsonb)
    );
  END IF;

  IF p_action = 'create' THEN
    v_clean_code := upper(trim(COALESCE(p_code, '')));
    IF length(v_clean_code) < 3 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Код должен содержать минимум 3 символа.');
    END IF;

    IF EXISTS (SELECT 1 FROM public.promo_codes WHERE upper(code) = v_clean_code) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Промокод «' || v_clean_code || '» уже существует.');
    END IF;

    INSERT INTO public.promo_codes (
      code,
      duration_days,
      role,
      is_active,
      max_uses,
      used_count,
      used_by,
      note,
      created_by,
      created_at
    ) VALUES (
      v_clean_code,
      GREATEST(1, p_duration),
      COALESCE(lower(trim(p_role)), 'subscriber'),
      true,
      GREATEST(0, p_max_uses),
      0,
      '[]'::jsonb,
      COALESCE(trim(p_note), ''),
      p_actor_id::text,
      timezone('utc', now())
    );

    RETURN jsonb_build_object(
      'ok', true,
      'code', v_clean_code,
      'durationDays', p_duration,
      'role', p_role,
      'maxUses', p_max_uses,
      'note', p_note
    );
  END IF;

  IF p_action = 'delete' THEN
    v_clean_code := upper(trim(COALESCE(p_code, '')));
    DELETE FROM public.promo_codes WHERE upper(code) = v_clean_code;
    RETURN jsonb_build_object('ok', true);
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'Неизвестное действие.');
END;
$$;

-- 6. Admin User Management (Roles, Subscriptions, Ban, HWID, Display Name, Freeze)
CREATE OR REPLACE FUNCTION public.admin_manage_profile(
  p_actor_id bigint,
  p_target_id bigint,
  p_field text,
  p_value jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target record;
BEGIN
  IF NOT public.is_profile_admin(p_actor_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Доступ запрещён.');
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE profile_id = p_target_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Целевой профиль не найден.');
  END IF;

  IF p_field = 'roles' THEN
    UPDATE public.profiles
    SET roles = ARRAY(SELECT jsonb_array_elements_text(p_value))
    WHERE profile_id = p_target_id;
  ELSIF p_field = 'is_banned' THEN
    UPDATE public.profiles
    SET
      is_banned = (p_value->>'isBanned')::boolean,
      banned_at = CASE WHEN (p_value->>'isBanned')::boolean THEN timezone('utc', now()) ELSE null END
    WHERE profile_id = p_target_id;
  ELSIF p_field = 'subscription_until' THEN
    UPDATE public.profiles
    SET subscription_until = (p_value->>'subscriptionUntil')::timestamptz
    WHERE profile_id = p_target_id;
  ELSIF p_field = 'hwid' THEN
    UPDATE public.profiles
    SET hwid = NULL
    WHERE profile_id = p_target_id;
  ELSIF p_field = 'display_name' THEN
    UPDATE public.profiles
    SET display_name = p_value->>'displayName'
    WHERE profile_id = p_target_id;
  ELSIF p_field = 'login' THEN
    UPDATE public.profiles
    SET login = p_value->>'login'
    WHERE profile_id = p_target_id;
  ELSIF p_field = 'toggle_freeze' THEN
    IF v_target.is_frozen = true THEN
      DECLARE
        v_rem bigint := COALESCE(v_target.frozen_remaining_ms, 30 * 86400000);
        v_unt timestamptz := timezone('utc', now()) + (v_rem || ' milliseconds')::interval;
      BEGIN
        UPDATE public.profiles
        SET is_frozen = false, frozen_at = null, frozen_remaining_ms = 0, subscription_until = v_unt
        WHERE profile_id = p_target_id;
      END;
    ELSE
      DECLARE
        v_until timestamptz := COALESCE(v_target.subscription_until, timezone('utc', now()) + interval '30 days');
        v_rem bigint := GREATEST(86400000, (EXTRACT(EPOCH FROM (v_until - timezone('utc', now()))) * 1000)::bigint);
      BEGIN
        UPDATE public.profiles
        SET is_frozen = true, frozen_at = timezone('utc', now()), frozen_remaining_ms = v_rem
        WHERE profile_id = p_target_id;
      END;
    END IF;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'Неизвестное поле для обновления.');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 7. Add Comment (Direct to Supabase profile_comments)
CREATE OR REPLACE FUNCTION public.add_profile_comment(
  p_profile_id bigint,
  p_author_profile_id bigint,
  p_author_name text,
  p_author_photo_url text,
  p_author_accent_role text,
  p_message text,
  p_media_url text DEFAULT NULL,
  p_media_type text DEFAULT NULL,
  p_media_path text DEFAULT NULL,
  p_media_size bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_id uuid := gen_random_uuid();
  v_now timestamptz := timezone('utc', now());
BEGIN
  INSERT INTO public.profile_comments (
    id,
    profile_id,
    author_profile_id,
    author_name,
    author_photo_url,
    author_accent_role,
    message,
    media_url,
    media_type,
    media_path,
    media_size,
    created_at,
    updated_at
  ) VALUES (
    v_new_id,
    p_profile_id,
    p_author_profile_id,
    p_author_name,
    p_author_photo_url,
    p_author_accent_role,
    COALESCE(p_message, ''),
    p_media_url,
    p_media_type,
    p_media_path,
    p_media_size,
    v_now,
    v_now
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_new_id,
    'profileId', p_profile_id,
    'authorProfileId', p_author_profile_id,
    'authorName', p_author_name,
    'authorPhotoURL', p_author_photo_url,
    'authorAccentRole', p_author_accent_role,
    'message', p_message,
    'mediaURL', p_media_url,
    'mediaType', p_media_type,
    'mediaPath', p_media_path,
    'mediaSize', p_media_size,
    'createdAt', to_char(v_now, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
END;
$$;

-- 8. Delete Comment
CREATE OR REPLACE FUNCTION public.delete_profile_comment(
  p_comment_id uuid,
  p_actor_profile_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_comm record;
BEGIN
  SELECT * INTO v_comm FROM public.profile_comments WHERE id = p_comment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Комментарий не найден.');
  END IF;

  -- Allow deletion if actor is author, or profile owner, or admin
  IF v_comm.author_profile_id = p_actor_profile_id
     OR v_comm.profile_id = p_actor_profile_id
     OR public.is_profile_admin(p_actor_profile_id)
  THEN
    DELETE FROM public.profile_comments WHERE id = p_comment_id;
    RETURN jsonb_build_object('ok', true);
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'У вас нет прав для удаления этого комментария.');
END;
$$;

-- 9. Grant Execute on all RPC functions to anon and authenticated
GRANT EXECUTE ON FUNCTION public.is_profile_admin(bigint) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_free_trial(bigint) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(text, bigint) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.toggle_subscription_freeze(bigint) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_manage_promo(text, bigint, text, int, text, int, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_manage_profile(bigint, bigint, text, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_profile_comment(bigint, bigint, text, text, text, text, text, text, text, bigint) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_profile_comment(uuid, bigint) TO anon, authenticated, service_role;

-- 10. Update public_profiles view with subscription, trial, freeze, and history columns
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  null::uuid as auth_user_id,
  coalesce(p.firebase_uid, p.auth_user_id::text) as firebase_uid,
  p.profile_id,
  null::text as email,
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

