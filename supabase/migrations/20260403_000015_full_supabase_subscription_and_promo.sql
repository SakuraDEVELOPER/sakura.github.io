-- ============================================================
-- FULL SUPABASE MIGRATION: Subscription fields + Promo codes table
-- ============================================================

-- 1. Добавляем колонки подписок, привязок и заморозки в profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_until timestamptz,
  ADD COLUMN IF NOT EXISTS has_claimed_trial boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_frozen boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS frozen_remaining_ms bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS activation_history jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hwid text;

-- 2. Создаем таблицу promo_codes
CREATE TABLE IF NOT EXISTS public.promo_codes (
  code text PRIMARY KEY,
  duration_days integer NOT NULL DEFAULT 30,
  role text NOT NULL DEFAULT 'subscriber',
  is_active boolean NOT NULL DEFAULT true,
  max_uses integer DEFAULT 1,
  used_count integer DEFAULT 0,
  used_by jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT timezone('utc', now()),
  created_by text DEFAULT '1',
  note text DEFAULT ''
);

-- Индекс для активных промокодов
CREATE INDEX IF NOT EXISTS promo_codes_is_active_idx ON public.promo_codes (is_active);

-- 3. Настройка RLS (Row Level Security)
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики, если были
DROP POLICY IF EXISTS "service_role_all_promo_codes" ON public.promo_codes;
DROP POLICY IF EXISTS "authenticated_read_promo_codes" ON public.promo_codes;
DROP POLICY IF EXISTS "anon_read_active_promo_codes" ON public.promo_codes;

-- Сервисный ключ (бэкенд, Edge Functions, мигратор) имеет полный доступ
CREATE POLICY "service_role_all_promo_codes"
  ON public.promo_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Обычные пользователи и гости могут проверять промокоды
CREATE POLICY "anon_read_active_promo_codes"
  ON public.promo_codes
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- 4. Обновляем view public_profiles, чтобы он корректно отдавал публичные данные
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
  array[]::text[] as provider_ids,
  '[]'::jsonb as login_history,
  '[]'::jsonb as visit_history,
  p.created_at,
  p.last_sign_in_at
FROM public.profiles as p;
