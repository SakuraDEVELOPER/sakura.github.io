# Supabase Migration Stage 9

This stage adds client-side `Supabase Auth` groundwork in parallel with the existing `Firebase Auth` runtime.

Files:

- [supabase-auth-runtime.ts](/d:/site/dota-project-site/src/app/supabase-auth-runtime.ts)
- [supabase-auth-boot.tsx](/d:/site/dota-project-site/src/app/supabase-auth-boot.tsx)
- [layout.tsx](/d:/site/dota-project-site/src/app/layout.tsx)

What it does:

- boots `Supabase Auth` on profile pages, on stored Supabase sessions, or on idle interaction
- exposes a parallel browser runtime:
  - `window.sakuraSupabaseAuth`
  - `window.sakuraSupabaseCurrentUserSnapshot`
  - `window.sakuraSupabaseAuthError`
- listens for Supabase session changes
- prepares a future `Google OAuth` cutover without breaking the current Firebase-based login flow

What it does not do yet:

- it does not replace `window.sakuraFirebaseAuth`
- it does not switch the visible login button to Supabase yet
- it does not remove Firebase Auth

Why this stage matters:

- the site can now understand both auth worlds
- we can migrate Google auth next without jumping straight from Firebase-only to Supabase-only
