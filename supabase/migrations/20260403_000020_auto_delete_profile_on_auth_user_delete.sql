-- ============================================================
-- 20260403_000020_auto_delete_profile_on_auth_user_delete.sql
-- Automatically cascade delete profile from public.profiles 
-- when an admin deletes a user from Supabase Dashboard (auth.users)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_auth_user_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clean up presence
  DELETE FROM public.profile_presence WHERE auth_user_id = OLD.id;
  
  -- Clean up profile comments if profile_id exists
  DELETE FROM public.profile_comments 
  WHERE profile_id IN (SELECT profile_id FROM public.profiles WHERE auth_user_id = OLD.id OR lower(email) = lower(OLD.email))
     OR author_profile_id IN (SELECT profile_id FROM public.profiles WHERE auth_user_id = OLD.id OR lower(email) = lower(OLD.email));

  -- Clean up public.profiles
  DELETE FROM public.profiles 
  WHERE auth_user_id = OLD.id 
     OR lower(email) = lower(OLD.email);

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_delete();
