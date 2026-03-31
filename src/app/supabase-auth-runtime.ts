"use client";

import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type SupabaseAuthUserSnapshot = {
  id: string;
  email: string | null;
  providerIds: string[];
  createdAt: string | null;
  lastSignInAt: string | null;
  hasSession: boolean;
};

type SupabaseAuthBridge = {
  loginWithGoogle: () => Promise<null>;
  logout: () => Promise<void>;
  getSession: () => Promise<Session | null>;
  onAuthStateChanged: (callback: (user: SupabaseAuthUserSnapshot | null) => void) => () => void;
};

type SupabaseRuntimeWindow = Window & {
  sakuraSupabaseAuth?: SupabaseAuthBridge;
  sakuraSupabaseCurrentUserSnapshot?: SupabaseAuthUserSnapshot | null;
  sakuraSupabaseAuthError?: string | null;
  sakuraSupabaseAuthReady?: boolean;
};

const SUPABASE_AUTH_READY_EVENT = "sakura-supabase-auth-ready";
const SUPABASE_AUTH_ERROR_EVENT = "sakura-supabase-auth-error";
const SUPABASE_USER_UPDATE_EVENT = "sakura-supabase-user-update";

const getRuntimeWindow = () => window as SupabaseRuntimeWindow;

const normalizeProviderIds = (user: User | null) => {
  if (!user) {
    return [];
  }

  const identities = Array.isArray(user.identities) ? user.identities : [];
  const providerIds = identities
    .map((identity) =>
      typeof identity?.provider === "string" ? identity.provider.trim() : ""
    )
    .filter(Boolean);

  if (providerIds.length) {
    return [...new Set(providerIds)];
  }

  const primaryProvider =
    typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider.trim() : "";

  return primaryProvider ? [primaryProvider] : [];
};

const toSupabaseSnapshot = (session: Session | null): SupabaseAuthUserSnapshot | null => {
  const user = session?.user ?? null;

  if (!user?.id) {
    return null;
  }

  return {
    id: user.id,
    email: typeof user.email === "string" ? user.email : null,
    providerIds: normalizeProviderIds(user),
    createdAt: typeof user.created_at === "string" ? user.created_at : null,
    lastSignInAt:
      typeof user.last_sign_in_at === "string" ? user.last_sign_in_at : null,
    hasSession: Boolean(session?.access_token),
  };
};

const publishSnapshot = (snapshot: SupabaseAuthUserSnapshot | null) => {
  const runtime = getRuntimeWindow();
  runtime.sakuraSupabaseCurrentUserSnapshot = snapshot;
  runtime.dispatchEvent(
    new CustomEvent(SUPABASE_USER_UPDATE_EVENT, {
      detail: { user: snapshot },
    })
  );
  return snapshot;
};

const buildSupabaseRedirectTo = () => {
  try {
    return window.location.href;
  } catch {
    return undefined;
  }
};

export const startSupabaseAuthRuntime = async () => {
  const runtime = getRuntimeWindow();

  if (runtime.sakuraSupabaseAuthReady && runtime.sakuraSupabaseAuth) {
    return runtime.sakuraSupabaseAuth;
  }

  if (!isSupabaseConfigured || !supabase) {
    runtime.sakuraSupabaseAuthReady = true;
    runtime.sakuraSupabaseAuthError = null;
    runtime.dispatchEvent(new CustomEvent(SUPABASE_AUTH_READY_EVENT));
    return null;
  }

  const client = supabase as SupabaseClient;

  try {
    const bridge: SupabaseAuthBridge = {
      loginWithGoogle: async () => {
        const { error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: buildSupabaseRedirectTo(),
          },
        });

        if (error) {
          throw error;
        }

        return null;
      },
      logout: async () => {
        const { error } = await client.auth.signOut();

        if (error) {
          throw error;
        }
      },
      getSession: async () => {
        const { data, error } = await client.auth.getSession();

        if (error) {
          throw error;
        }

        return data.session ?? null;
      },
      onAuthStateChanged: (callback) => {
        const {
          data: { subscription },
        } = client.auth.onAuthStateChange((_event, session) => {
          callback(publishSnapshot(toSupabaseSnapshot(session)));
        });

        callback(runtime.sakuraSupabaseCurrentUserSnapshot ?? null);
        return () => {
          subscription.unsubscribe();
        };
      },
    };

    runtime.sakuraSupabaseAuth = bridge;

    const { data, error } = await client.auth.getSession();

    if (error) {
      throw error;
    }

    publishSnapshot(toSupabaseSnapshot(data.session ?? null));

    client.auth.onAuthStateChange((_event, session) => {
      publishSnapshot(toSupabaseSnapshot(session));
    });

    runtime.sakuraSupabaseAuthReady = true;
    runtime.sakuraSupabaseAuthError = null;
    runtime.dispatchEvent(new CustomEvent(SUPABASE_AUTH_READY_EVENT));
    return bridge;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to initialize Supabase Auth.";

    runtime.sakuraSupabaseAuthError = message;
    runtime.sakuraSupabaseAuthReady = true;
    runtime.dispatchEvent(
      new CustomEvent(SUPABASE_AUTH_ERROR_EVENT, {
        detail: { message },
      })
    );
    return null;
  }
};
