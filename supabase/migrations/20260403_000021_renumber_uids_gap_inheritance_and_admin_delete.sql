-- ============================================================
-- 20260403_000021_renumber_uids_gap_inheritance_and_admin_delete.sql
-- 1. Cascade foreign keys for profile_id on update
-- 2. Renumber existing profile_ids sequentially (1, 2, 3...)
-- 3. Gap-filling trigger: next registered user inherits deleted UID
-- 4. Admin function to permanently delete any user account
-- ============================================================

-- 1. Ensure foreign keys support ON UPDATE CASCADE
ALTER TABLE public.profile_presence
  DROP CONSTRAINT IF EXISTS profile_presence_profile_id_fkey,
  ADD CONSTRAINT profile_presence_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profiles(profile_id)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.profile_comments
  DROP CONSTRAINT IF EXISTS profile_comments_profile_id_fkey,
  DROP CONSTRAINT IF EXISTS profile_comments_author_profile_id_fkey,
  ADD CONSTRAINT profile_comments_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profiles(profile_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT profile_comments_author_profile_id_fkey
    FOREIGN KEY (author_profile_id) REFERENCES public.profiles(profile_id)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. Renumber all existing profiles cleanly starting from 1
DO $$
DECLARE
  rec RECORD;
  v_new_id bigint := 1;
BEGIN
  -- Shift all IDs to a high offset first to avoid unique key collision during updates
  UPDATE public.profiles SET profile_id = profile_id + 10000000;

  FOR rec IN (
    SELECT profile_id
    FROM public.profiles
    ORDER BY created_at ASC NULLS LAST, profile_id ASC
  ) LOOP
    UPDATE public.profiles
    SET profile_id = v_new_id
    WHERE profile_id = rec.profile_id;

    v_new_id := v_new_id + 1;
  END LOOP;

  -- Reset sequence to the highest allocated profile_id
  PERFORM setval('public.profile_id_seq', GREATEST(1, v_new_id - 1), true);
END $$;

-- 3. Automatic Gap-Filling UID Trigger:
-- When an account is deleted, its UID is freed. The next user who registers
-- automatically inherits the lowest freed UID in the sequence!
CREATE OR REPLACE FUNCTION public.handle_profile_id_gap_allocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_id bigint;
BEGIN
  IF NEW.profile_id IS NULL OR NEW.profile_id <= 0 THEN
    SELECT COALESCE(
      (
        SELECT s.id
        FROM generate_series(1, COALESCE((SELECT max(profile_id) FROM public.profiles), 0) + 1) AS s(id)
        WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.profile_id = s.id)
        ORDER BY s.id ASC
        LIMIT 1
      ),
      1
    ) INTO v_next_id;

    NEW.profile_id := v_next_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_profile_id ON public.profiles;
CREATE TRIGGER trg_assign_profile_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_id_gap_allocation();

-- 4. Admin function to permanently delete any user account from the Admin panel
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

  -- Delete presence
  DELETE FROM public.profile_presence WHERE profile_id = p_target_profile_id;

  -- Delete comments authored by or written on this profile
  DELETE FROM public.profile_comments 
  WHERE profile_id = p_target_profile_id OR author_profile_id = p_target_profile_id;

  -- Delete from profiles
  DELETE FROM public.profiles WHERE profile_id = p_target_profile_id;

  -- Delete from auth.users (frees the email and password account completely)
  IF v_auth_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_auth_user_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_profile(bigint, bigint) TO anon, authenticated, service_role;
