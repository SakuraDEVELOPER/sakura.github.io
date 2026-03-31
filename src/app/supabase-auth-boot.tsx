"use client";

import { useEffect } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";

type SupabaseBootWindow = Window & {
  sakuraStartSupabaseAuth?: () => Promise<unknown> | unknown;
  sakuraSupabaseRuntimePromise?: Promise<unknown> | null;
};

const getWindowState = () => window as SupabaseBootWindow;
const SUPABASE_AUTH_STORAGE_KEY_SUFFIX = "-auth-token";
const AUTH_IDLE_PRELOAD_TIMEOUT_MS = 700;
const AUTH_FALLBACK_PRELOAD_TIMEOUT_MS = 450;

const hasPersistedSupabaseSession = () => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const storageKey = window.localStorage.key(index);

      if (storageKey?.startsWith("sb-") && storageKey.endsWith(SUPABASE_AUTH_STORAGE_KEY_SUFFIX)) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
};

const shouldBootImmediately = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    /(?:^|\/)profile(?:\/|$)/.test(window.location.pathname) ||
    hasPersistedSupabaseSession()
  );
};

export default function SupabaseAuthBoot() {
  useEffect(() => {
    if (typeof window === "undefined" || !isSupabaseConfigured) {
      return;
    }

    const runtime = getWindowState();
    let idleTimerId = 0;
    let idleCallbackId: number | null = null;
    const interactionEvents = ["pointerdown", "keydown", "touchstart"] as const;

    const cleanupDeferredLoad = () => {
      interactionEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleInteractionStart);
      });

      if (
        idleCallbackId !== null &&
        "cancelIdleCallback" in window &&
        typeof window.cancelIdleCallback === "function"
      ) {
        window.cancelIdleCallback(idleCallbackId);
      }

      if (idleTimerId) {
        window.clearTimeout(idleTimerId);
      }

      idleCallbackId = null;
      idleTimerId = 0;
    };

    const loadRuntime = async () => {
      if (!runtime.sakuraSupabaseRuntimePromise) {
        runtime.sakuraSupabaseRuntimePromise = import("./supabase-auth-runtime")
          .then(({ startSupabaseAuthRuntime }) => startSupabaseAuthRuntime())
          .finally(() => {
            runtime.sakuraSupabaseRuntimePromise = null;
          });
      }

      return runtime.sakuraSupabaseRuntimePromise;
    };

    const bootNow = () => {
      cleanupDeferredLoad();
      return loadRuntime();
    };

    const handleInteractionStart = () => {
      void bootNow();
    };

    runtime.sakuraStartSupabaseAuth = bootNow;

    if (shouldBootImmediately()) {
      void bootNow();
      return;
    }

    interactionEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleInteractionStart, { once: true, passive: true });
    });

    if ("requestIdleCallback" in window && typeof window.requestIdleCallback === "function") {
      idleCallbackId = window.requestIdleCallback(() => {
        void loadRuntime();
      }, { timeout: AUTH_IDLE_PRELOAD_TIMEOUT_MS });
    } else {
      idleTimerId = window.setTimeout(() => {
        void loadRuntime();
      }, AUTH_FALLBACK_PRELOAD_TIMEOUT_MS);
    }

    return () => {
      cleanupDeferredLoad();
    };
  }, []);

  return null;
}
