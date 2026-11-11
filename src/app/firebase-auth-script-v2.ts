const firebaseModuleScript = `
  (() => {
    const AUTH_RUNTIME_VERSION = "2026-04-05-runtime-v3";
    const AUTH_STATE_SETTLED_EVENT = "sakura-auth-state-settled";
    const USER_UPDATE_EVENT = "sakura-user-update";
    const CURRENT_PROFILE_ID_STORAGE_KEY = "sakura-current-profile-id";

    const SUPABASE_PUBLIC_URL = ${JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://cwiljdpxgawxglgciily.supabase.co")};
    const SUPABASE_PUBLIC_ANON_KEY = ${JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "")};
    const SUPABASE_REST_URL = SUPABASE_PUBLIC_URL.replace(/\\/+$/, "") + "/rest/v1";

    let supabase = null;
    let authStateSettled = false;

    const createFirebaseError = (code, message) => {
      const err = new Error(message);
      err.code = code;
      return err;
    };

    const buildSupabaseRestUrl = (table, query = {}) => {
      const url = new URL(SUPABASE_REST_URL + "/" + table);
      Object.entries(query).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== "") {
          url.searchParams.set(key, String(value));
        }
      });
      return url.toString();
    };

    const fetchSupabaseRows = async (table, query = {}) => {
      try {
        const response = await fetch(buildSupabaseRestUrl(table, query), {
          headers: {
            apikey: SUPABASE_PUBLIC_ANON_KEY,
            Authorization: "Bearer " + SUPABASE_PUBLIC_ANON_KEY,
            "Accept-Profile": "public",
            Accept: "application/json",
          },
        });
        if (!response.ok) return null;
        const payload = await response.json();
        return Array.isArray(payload) ? payload : null;
      } catch (e) {
        return null;
      }
    };

    const callSupabaseRpc = async (funcName, params = {}) => {
      try {
        const response = await fetch(SUPABASE_REST_URL + "/rpc/" + funcName, {
          method: "POST",
          headers: {
            apikey: SUPABASE_PUBLIC_ANON_KEY,
            Authorization: "Bearer " + SUPABASE_PUBLIC_ANON_KEY,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          let errText = "";
          try {
            const errObj = await response.json();
            errText = errObj?.message || errObj?.error || JSON.stringify(errObj);
          } catch {
            errText = await response.text().catch(() => "");
          }
          return { ok: false, error: errText || ("Supabase RPC " + funcName + " failed (" + response.status + ")") };
        }

        const resJson = await response.json();
        return typeof resJson === "object" && resJson !== null ? resJson : { ok: true, data: resJson };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "RPC Network Error" };
      }
    };

    let presenceHeartbeatIntervalId = null;
    let currentTrackingProfileId = null;
    let cachedOnlineUsers = null;
    let cachedOnlineUsersExpiresAt = 0;

    const sendPresenceTouch = (profileId, isOnline = true) => {
      if (!profileId) return;
      void callSupabaseRpc("touch_presence", {
        p_profile_id: profileId,
        p_path: typeof window !== "undefined" ? window.location.pathname : "/",
        p_is_online: isOnline
      }).catch(() => {});
    };

    const startPresenceHeartbeat = (profileId) => {
      if (currentTrackingProfileId === profileId && presenceHeartbeatIntervalId) {
        return;
      }
      stopPresenceHeartbeat(currentTrackingProfileId);
      if (!profileId) return;

      currentTrackingProfileId = profileId;
      sendPresenceTouch(profileId, true);

      presenceHeartbeatIntervalId = window.setInterval(() => {
        sendPresenceTouch(profileId, true);
      }, 30000);
    };

    const stopPresenceHeartbeat = (profileId) => {
      if (presenceHeartbeatIntervalId) {
        window.clearInterval(presenceHeartbeatIntervalId);
        presenceHeartbeatIntervalId = null;
      }
      const pid = profileId || currentTrackingProfileId;
      if (pid) {
        sendPresenceTouch(pid, false);
      }
      currentTrackingProfileId = null;
    };

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        if (currentTrackingProfileId) {
          sendPresenceTouch(currentTrackingProfileId, false);
        }
      });
    }

    const publishUserSnapshot = (snapshot) => {
      window.sakuraCurrentUserSnapshot = snapshot;
      try {
        if (typeof snapshot?.profileId === "number" && snapshot.profileId > 0) {
          window.sessionStorage.setItem(CURRENT_PROFILE_ID_STORAGE_KEY, String(snapshot.profileId));
          startPresenceHeartbeat(snapshot.profileId);
        } else {
          window.sessionStorage.removeItem(CURRENT_PROFILE_ID_STORAGE_KEY);
          stopPresenceHeartbeat();
        }
      } catch (e) {}

      window.dispatchEvent(
        new CustomEvent(USER_UPDATE_EVENT, {
          detail: snapshot,
        })
      );
      return snapshot;
    };

    const markAuthStateSettled = () => {
      if (authStateSettled) return;
      authStateSettled = true;
      window.sakuraAuthStateSettled = true;
      window.dispatchEvent(new CustomEvent(AUTH_STATE_SETTLED_EVENT));
    };

    const mapSupabaseProfileRowToSnapshot = (row) => {
      if (!row) return null;
      const uid = row.firebase_uid || row.auth_user_id || (row.profile_id ? String(row.profile_id) : "user");
      return {
        uid,
        isAnonymous: false,
        email: row.email ?? null,
        emailVerified: row.email_verified === true,
        login: row.login ?? null,
        displayName: row.display_name ?? row.login ?? "Sakura User",
        profileId: typeof row.profile_id === "number" ? row.profile_id : Number(row.profile_id) || null,
        photoURL: row.photo_url || null,
        avatarPath: row.avatar_path || null,
        avatarType: row.avatar_type || null,
        avatarSize: row.avatar_size || null,
        roles: Array.isArray(row.roles) ? row.roles : [],
        isBanned: row.is_banned === true,
        bannedAt: row.banned_at || null,
        subscriptionUntil: row.subscription_until || null,
        subscription_until: row.subscription_until || null,
        hasClaimedTrial: row.has_claimed_trial === true,
        trialClaimedAt: row.trial_claimed_at || null,
        isFrozen: row.is_frozen === true,
        frozenAt: row.frozen_at || null,
        lastFrozenAt: row.last_frozen_at || null,
        frozenRemainingMs: typeof row.frozen_remaining_ms === "number" ? row.frozen_remaining_ms : null,
        activationHistory: Array.isArray(row.activation_history) ? row.activation_history : [],
        verificationRequired: row.verification_required === true,
        providerIds: Array.isArray(row.provider_ids) && row.provider_ids.length > 0 ? row.provider_ids : ["password"],
        creationTime: row.created_at || null,
        lastSignInTime: row.last_sign_in_at || null,
        loginHistory: Array.isArray(row.login_history) ? row.login_history : [],
        visitHistory: Array.isArray(row.visit_history) ? row.visit_history : [],
        presence: {
          lastSeenAt: row.last_sign_in_at || null,
          isOnline: true,
          status: "online"
        }
      };
    };

    const resolveUserSnapshot = async (user) => {
      if (!user) return null;
      const uid = user.id;
      const email = user.email || "";

      let rows = await fetchSupabaseRows("public_profiles", {
        auth_user_id: "eq." + uid,
        limit: 1
      });

      if (!rows || rows.length === 0) {
        if (email) {
          rows = await fetchSupabaseRows("public_profiles", {
            email: "ilike." + email,
            limit: 1
          });
        }
      }

      let profileRow = rows && rows[0] ? rows[0] : null;

      if (!profileRow) {
        const syncRes = await callSupabaseRpc("get_or_sync_auth_profile", {
          p_auth_user_id: uid,
          p_email: email,
          p_suggested_login: user.user_metadata?.login || null,
          p_suggested_display_name: user.user_metadata?.display_name || user.user_metadata?.full_name || null
        });
        if (syncRes?.ok && syncRes.profile) {
          profileRow = syncRes.profile;
        }
      }

      if (profileRow) {
        const snap = mapSupabaseProfileRowToSnapshot(profileRow);
        snap.emailVerified = Boolean(user.email_confirmed_at || profileRow.email_verified);
        return publishUserSnapshot(snap);
      }

      const fallbackSnap = {
        uid,
        isAnonymous: false,
        email: user.email ?? null,
        emailVerified: Boolean(user.email_confirmed_at),
        login: user.user_metadata?.login || (email ? email.split("@")[0] : "user"),
        displayName: user.user_metadata?.display_name || user.user_metadata?.login || "User",
        profileId: null,
        photoURL: user.user_metadata?.avatar_url || null,
        roles: ["user"],
        isBanned: false,
        providerIds: ["password"],
        creationTime: user.created_at || null,
        lastSignInTime: user.last_sign_in_at || null,
        loginHistory: [],
        visitHistory: [],
        presence: null
      };
      return publishUserSnapshot(fallbackSnap);
    };

    const createInlineAvatarDataUrl = async (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(createFirebaseError("storage/read-error", "Failed to read image file."));
        reader.readAsDataURL(file);
      });
    };

    let startPromise = null;
    const startFirebaseAuth = () => {
      if (startPromise) return startPromise;

      startPromise = (async () => {
        try {
          const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
          supabase = createClient(SUPABASE_PUBLIC_URL, SUPABASE_PUBLIC_ANON_KEY, {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true,
              storage: window.localStorage,
            }
          });
          window.supabaseClient = supabase;

          const bridge = {
            __runtimeVersion: AUTH_RUNTIME_VERSION,

            login: async (identifier, password) => {
              let email = (identifier || "").trim();
              if (!email.includes("@")) {
                const rows = await fetchSupabaseRows("public_profiles", { login: "ilike." + email, limit: 1 });
                if (!rows || !rows[0] || !rows[0].email) {
                  throw createFirebaseError("auth/login-not-found", "Пользователь с таким логином не найден.");
                }
                email = rows[0].email;
              }

              const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
              });

              if (error) {
                if (error.message.includes("Invalid login credentials") || error.message.includes("invalid_grant")) {
                  throw createFirebaseError("auth/wrong-password", "Неверный логин, email или пароль.");
                }
                if (error.message.includes("Email not confirmed")) {
                  throw createFirebaseError("auth/email-not-verified", "Подтвердите email для входа.");
                }
                throw createFirebaseError("auth/error", error.message);
              }

              return await resolveUserSnapshot(data.user);
            },

            register: async ({ login, displayName, email, password }) => {
              const cleanLogin = (login || "").trim().replace(/\\s+/g, "");
              const cleanEmail = (email || "").trim().toLowerCase();
              const cleanDisplay = (displayName || "").trim() || cleanLogin;

              if (cleanLogin.length < 3) {
                throw createFirebaseError("auth/invalid-login", "Логин должен содержать от 3 символов.");
              }

              const existingLogin = await fetchSupabaseRows("public_profiles", { login: "ilike." + cleanLogin, limit: 1 });
              if (existingLogin && existingLogin.length > 0) {
                throw createFirebaseError("auth/login-already-in-use", "Этот логин уже занят.");
              }

              const existingEmail = await fetchSupabaseRows("public_profiles", { email: "ilike." + cleanEmail, limit: 1 });
              if (existingEmail && existingEmail.length > 0) {
                throw createFirebaseError("auth/email-already-in-use", "Этот email уже зарегистрирован.");
              }

              const { data, error } = await supabase.auth.signUp({
                email: cleanEmail,
                password,
                options: {
                  data: {
                    login: cleanLogin,
                    display_name: cleanDisplay
                  }
                }
              });

              if (error) {
                if (error.message.includes("User already registered")) {
                  throw createFirebaseError("auth/email-already-in-use", "Этот email уже зарегистрирован.");
                }
                if (error.message.toLowerCase().includes("rate limit") || error.message.toLowerCase().includes("rate_limit")) {
                  throw createFirebaseError(
                    "auth/rate-limit-exceeded",
                    "Превышен лимит отправки писем. Отключите 'Confirm email' в настройках Supabase (Authentication -> Providers -> Email) для мгновенной регистрации без ограничений."
                  );
                }
                throw createFirebaseError("auth/registration-failed", error.message);
              }

              if (data?.user) {
                await callSupabaseRpc("register_profile", {
                  p_login: cleanLogin,
                  p_display_name: cleanDisplay,
                  p_email: cleanEmail,
                  p_auth_user_id: data.user.id
                });
              }

              return await resolveUserSnapshot(data.user);
            },

            loginWithGoogle: async () => {
              const { data, error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                  redirectTo: window.location.origin
                }
              });
              if (error) {
                throw createFirebaseError("auth/google-error", error.message);
              }
              return null;
            },

            completeGoogleAccount: async ({ login, displayName, password }) => {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session?.user) {
                throw createFirebaseError("auth/no-current-user", "Авторизуйтесь через Google.");
              }

              if (password) {
                await supabase.auth.updateUser({ password });
              }

              const res = await callSupabaseRpc("complete_google_profile", {
                p_auth_user_id: session.user.id,
                p_login: login.trim(),
                p_display_name: displayName?.trim() || login.trim()
              });

              if (res && !res.ok) {
                throw createFirebaseError("auth/invalid-login", res.error || "Не удалось завершить Google-аккаунт.");
              }

              return await resolveUserSnapshot(session.user);
            },

            sendPasswordReset: async (identifier) => {
              let email = (identifier || "").trim();
              if (!email.includes("@")) {
                const rows = await fetchSupabaseRows("public_profiles", { login: "ilike." + email, limit: 1 });
                if (!rows || !rows[0] || !rows[0].email) {
                  throw createFirebaseError("auth/login-not-found", "Пользователь с таким логином не найден.");
                }
                email = rows[0].email;
              }

              const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin
              });

              if (error) {
                if (error.message.toLowerCase().includes("rate limit") || error.message.toLowerCase().includes("rate_limit")) {
                  throw createFirebaseError(
                    "auth/rate-limit-exceeded",
                    "Превышен лимит отправки писем сброса пароля. Подождите немного или настройте Custom SMTP в Supabase."
                  );
                }
                throw createFirebaseError("auth/reset-failed", error.message);
              }

              return { email };
            },

            updatePassword: async (currentPassword, nextPassword) => {
              const { data, error } = await supabase.auth.updateUser({ password: nextPassword });
              if (error) {
                throw createFirebaseError("auth/update-failed", error.message);
              }
              return await resolveUserSnapshot(data.user);
            },

            deleteCurrentAccount: async () => {
              await supabase.auth.signOut();
              publishUserSnapshot(null);
            },

            updateDisplayName: async (displayName) => {
              const profileId = window.sakuraCurrentUserSnapshot?.profileId;
              if (!profileId) throw createFirebaseError("auth/no-current-user", "Not signed in.");
              await callSupabaseRpc("update_profile_info", {
                p_profile_id: profileId,
                p_display_name: displayName.trim()
              });
              const { data: { session } } = await supabase.auth.getSession();
              return await resolveUserSnapshot(session?.user);
            },

            updateUsername: async (username) => {
              const session = (await supabase.auth.getSession()).data.session;
              if (!session?.user) throw createFirebaseError("auth/no-current-user", "Not signed in.");
              const res = await callSupabaseRpc("complete_google_profile", {
                p_auth_user_id: session.user.id,
                p_login: username.trim()
              });
              if (res && !res.ok) {
                throw createFirebaseError("auth/invalid-login", res.error || "Failed to update login.");
              }
              return await resolveUserSnapshot(session.user);
            },

            adminUpdateProfileDisplayName: async (profileId, displayName) => {
              const actorId = window.sakuraCurrentUserSnapshot?.profileId || 1;
              const res = await callSupabaseRpc("admin_manage_profile", {
                p_actor_id: actorId,
                p_target_id: profileId,
                p_field: "display_name",
                p_value: { displayName: displayName.trim() }
              });
              if (res && !res.ok) throw new Error(res.error || "Failed");
              return await bridge.getProfileById(profileId);
            },

            adminUpdateProfileLogin: async (profileId, login) => {
              const actorId = window.sakuraCurrentUserSnapshot?.profileId || 1;
              const res = await callSupabaseRpc("admin_manage_profile", {
                p_actor_id: actorId,
                p_target_id: profileId,
                p_field: "login",
                p_value: { login: login.trim() }
              });
              if (res && !res.ok) throw new Error(res.error || "Failed");
              return await bridge.getProfileById(profileId);
            },

            adminUpdateProfileThemeSong: async (profileId, themeSongKey) => {
              return await bridge.getProfileById(profileId);
            },

            adminUpdateProfileSubscriptionUntil: async (profileId, subscriptionUntil) => {
              const actorId = window.sakuraCurrentUserSnapshot?.profileId || 1;
              const res = await callSupabaseRpc("admin_manage_profile", {
                p_actor_id: actorId,
                p_target_id: profileId,
                p_field: "subscription_until",
                p_value: { subscriptionUntil }
              });
              if (res && !res.ok) throw new Error(res.error || "Failed");
              return await bridge.getProfileById(profileId);
            },

            adminResetProfileHwid: async (profileId) => {
              const actorId = window.sakuraCurrentUserSnapshot?.profileId || 1;
              const res = await callSupabaseRpc("admin_manage_profile", {
                p_actor_id: actorId,
                p_target_id: profileId,
                p_field: "hwid",
                p_value: {}
              });
              if (res && !res.ok) throw new Error(res.error || "Failed");
              return await bridge.getProfileById(profileId);
            },

            adminSetProfileBan: async (profileId, isBanned) => {
              const actorId = window.sakuraCurrentUserSnapshot?.profileId || 1;
              const res = await callSupabaseRpc("admin_manage_profile", {
                p_actor_id: actorId,
                p_target_id: profileId,
                p_field: "is_banned",
                p_value: { isBanned }
              });
              if (res && !res.ok) throw new Error(res.error || "Failed");
              return await bridge.getProfileById(profileId);
            },

            adminSetProfileEmailVerification: async (profileId, isVerified) => {
              return await bridge.getProfileById(profileId);
            },

            updateProfileRoles: async (profileId, roles) => {
              const actorId = window.sakuraCurrentUserSnapshot?.profileId || 1;
              const res = await callSupabaseRpc("admin_manage_profile", {
                p_actor_id: actorId,
                p_target_id: profileId,
                p_field: "roles",
                p_value: roles
              });
              if (res && !res.ok) throw new Error(res.error || "Failed");
              return await bridge.getProfileById(profileId);
            },

            freezeSubscription: async () => {
              const profileId = window.sakuraCurrentUserSnapshot?.profileId;
              if (!profileId) throw createFirebaseError("auth/no-current-user", "Sign in first.");
              const res = await callSupabaseRpc("toggle_subscription_freeze", { p_profile_id: profileId });
              if (res && !res.ok) throw new Error(res.error || "Freeze failed");
              return await bridge.getProfileById(profileId);
            },

            unfreezeSubscription: async () => {
              const profileId = window.sakuraCurrentUserSnapshot?.profileId;
              if (!profileId) throw createFirebaseError("auth/no-current-user", "Sign in first.");
              const res = await callSupabaseRpc("toggle_subscription_freeze", { p_profile_id: profileId });
              if (res && !res.ok) throw new Error(res.error || "Unfreeze failed");
              return await bridge.getProfileById(profileId);
            },

            adminToggleUserFreeze: async (profileId) => {
              const actorId = window.sakuraCurrentUserSnapshot?.profileId || 1;
              const res = await callSupabaseRpc("admin_manage_profile", {
                p_actor_id: actorId,
                p_target_id: profileId,
                p_field: "toggle_freeze",
                p_value: {}
              });
              if (res && !res.ok) throw new Error(res.error || "Toggle freeze failed");
              return await bridge.getProfileById(profileId);
            },

            adminCreatePromoCode: async ({ code, durationDays, maxUses, role, note }) => {
              const actorId = window.sakuraCurrentUserSnapshot?.profileId || 1;
              const res = await callSupabaseRpc("admin_manage_promo", {
                p_action: "create",
                p_actor_id: actorId,
                p_code: code,
                p_duration: durationDays,
                p_max_uses: maxUses,
                p_role: role || "subscriber",
                p_note: note || ""
              });
              if (res && !res.ok) throw new Error(res.error || "Create promo failed");
              return res;
            },

            adminListPromoCodes: async () => {
              const actorId = window.sakuraCurrentUserSnapshot?.profileId || 1;
              const res = await callSupabaseRpc("admin_manage_promo", {
                p_action: "list",
                p_actor_id: actorId
              });
              return res?.ok && Array.isArray(res.promos) ? res.promos : [];
            },

            adminDeletePromoCode: async (code) => {
              const actorId = window.sakuraCurrentUserSnapshot?.profileId || 1;
              const res = await callSupabaseRpc("admin_manage_promo", {
                p_action: "delete",
                p_actor_id: actorId,
                p_code: code
              });
              return Boolean(res?.ok);
            },

            redeemPromoCode: async (code) => {
              const profileId = window.sakuraCurrentUserSnapshot?.profileId;
              if (!profileId) throw createFirebaseError("auth/no-current-user", "Sign in first.");
              const res = await callSupabaseRpc("redeem_promo_code", {
                p_code: code,
                p_profile_id: profileId
              });
              if (res && !res.ok) throw new Error(res.error || "Failed to redeem promo");
              await bridge.getProfileById(profileId);
              return {
                success: true,
                durationDays: res.durationDays,
                isLifetime: res.isLifetime,
                newUntil: res.subscriptionUntil
              };
            },

            claimFreeTrial: async () => {
              const profileId = window.sakuraCurrentUserSnapshot?.profileId;
              if (!profileId) throw createFirebaseError("auth/no-current-user", "Sign in first.");
              const res = await callSupabaseRpc("claim_free_trial", {
                p_profile_id: profileId
              });
              if (res && !res.ok) throw new Error(res.error || "Failed to claim trial");
              await bridge.getProfileById(profileId);
              return {
                success: true,
                durationDays: res.durationDays,
                newUntil: res.subscriptionUntil
              };
            },

            updateAvatar: async (file) => {
              const profileId = window.sakuraCurrentUserSnapshot?.profileId;
              if (!profileId) throw createFirebaseError("auth/no-current-user", "Sign in first.");
              const dataUrl = await createInlineAvatarDataUrl(file);
              await callSupabaseRpc("update_profile_info", {
                p_profile_id: profileId,
                p_photo_url: dataUrl
              });
              const updated = {
                ...window.sakuraCurrentUserSnapshot,
                photoURL: dataUrl
              };
              return publishUserSnapshot(updated);
            },

            deleteAvatar: async () => {
              const profileId = window.sakuraCurrentUserSnapshot?.profileId;
              if (!profileId) throw createFirebaseError("auth/no-current-user", "Sign in first.");
              await callSupabaseRpc("update_profile_info", {
                p_profile_id: profileId,
                p_photo_url: ""
              });
              const updated = {
                ...window.sakuraCurrentUserSnapshot,
                photoURL: null
              };
              return publishUserSnapshot(updated);
            },

            adminUpdateProfileAvatar: async (profileId, file) => {
              const dataUrl = await createInlineAvatarDataUrl(file);
              await callSupabaseRpc("update_profile_info", {
                p_profile_id: profileId,
                p_photo_url: dataUrl
              });
              return await bridge.getProfileById(profileId);
            },

            adminDeleteProfileAvatar: async (profileId) => {
              await callSupabaseRpc("update_profile_info", {
                p_profile_id: profileId,
                p_photo_url: ""
              });
              return await bridge.getProfileById(profileId);
            },

            getProfileById: async (profileId) => {
              const rows = await fetchSupabaseRows("public_profiles", { profile_id: "eq." + profileId, limit: 1 });
              if (rows && rows[0]) {
                const snap = mapSupabaseProfileRowToSnapshot(rows[0]);
                if (window.sakuraCurrentUserSnapshot?.profileId === profileId) {
                  publishUserSnapshot(snap);
                }
                return snap;
              }
              return null;
            },

            getProfileByAuthorName: async (name) => {
              const rows = await fetchSupabaseRows("public_profiles", {
                login: "ilike." + name,
                limit: 1
              });
              if (rows && rows[0]) return mapSupabaseProfileRowToSnapshot(rows[0]);
              return null;
            },

            getProfilesByLoginPrefix: async (loginPrefix) => {
              const rows = await fetchSupabaseRows("public_profiles", {
                login: "ilike." + loginPrefix + "*",
                order: "profile_id.asc",
                limit: 8
              });
              return Array.isArray(rows) ? rows.map(mapSupabaseProfileRowToSnapshot).filter(Boolean) : [];
            },

            getProfileComments: async (profileId) => {
              const rows = await fetchSupabaseRows("public_profile_comments", {
                profile_id: "eq." + profileId,
                order: "created_at.desc",
                limit: 50
              });
              if (!Array.isArray(rows)) return [];
              return rows.map((r) => ({
                id: r.id,
                profileId: r.profile_id,
                authorProfileId: r.author_profile_id,
                authorName: r.author_name,
                authorPhotoURL: r.author_photo_url,
                authorAccentRole: r.author_accent_role,
                message: r.message,
                mediaURL: r.media_url,
                mediaType: r.media_type,
                mediaPath: r.media_path,
                mediaSize: r.media_size,
                createdAt: r.created_at,
                updatedAt: r.updated_at
              }));
            },

            isCommentMediaPathReferenced: async () => false,

            addProfileComment: async (payload) => {
              const res = await callSupabaseRpc("add_profile_comment", {
                p_profile_id: payload.profileId,
                p_author_profile_id: payload.authorProfileId,
                p_author_name: payload.authorName,
                p_author_photo_url: payload.authorPhotoURL || null,
                p_author_accent_role: payload.authorAccentRole || null,
                p_message: payload.message || "",
                p_media_url: payload.mediaURL || null,
                p_media_type: payload.mediaType || null,
                p_media_path: payload.mediaPath || null,
                p_media_size: payload.mediaSize || null
              });
              if (res && !res.ok) throw new Error(res.error || "Failed to add comment");
              return res;
            },

            updateProfileComment: async () => {
              return null;
            },

            deleteProfileComment: async (commentId, actorProfileId) => {
              const actorId = actorProfileId || window.sakuraCurrentUserSnapshot?.profileId || 1;
              const res = await callSupabaseRpc("delete_profile_comment", {
                p_comment_id: commentId,
                p_actor_profile_id: actorId
              });
              if (res && !res.ok) throw new Error(res.error || "Failed to delete comment");
              return true;
            },

            resendVerificationEmail: async () => {
              const session = (await supabase.auth.getSession()).data.session;
              if (session?.user?.email) {
                await supabase.auth.resend({
                  type: "signup",
                  email: session.user.email
                });
              }
              return window.sakuraCurrentUserSnapshot || null;
            },

            refreshVerificationStatus: async () => {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                return await resolveUserSnapshot(user);
              }
              return window.sakuraCurrentUserSnapshot || null;
            },

            getSiteOnlineUsers: async () => {
              const now = Date.now();
              if (cachedOnlineUsers && now < cachedOnlineUsersExpiresAt) {
                return cachedOnlineUsers;
              }

              try {
                const presenceRows = await fetchSupabaseRows("public_profile_presence", {
                  is_online: "eq.true",
                  order: "last_seen_at.desc",
                  limit: 50
                });

                const PRESENCE_MAX_AGE_MS = 90 * 1000;
                const freshRows = (Array.isArray(presenceRows) ? presenceRows : []).filter((r) => {
                  if (!r || !r.last_seen_at) return false;
                  const t = Date.parse(r.last_seen_at);
                  return Number.isFinite(t) && now - t <= PRESENCE_MAX_AGE_MS;
                });

                const activeProfileIds = new Set(freshRows.map((r) => r.profile_id).filter(Boolean));

                const curSnap = window.sakuraCurrentUserSnapshot;
                if (curSnap?.profileId && !curSnap.isBanned) {
                  activeProfileIds.add(curSnap.profileId);
                }

                if (activeProfileIds.size === 0) {
                  cachedOnlineUsers = [];
                  cachedOnlineUsersExpiresAt = now + 4000;
                  return [];
                }

                const idsArray = Array.from(activeProfileIds);
                const profileRows = await fetchSupabaseRows("public_profiles", {
                  select: "auth_user_id,profile_id,display_name,login,photo_url,roles,is_banned",
                  profile_id: "in.(" + idsArray.join(",") + ")"
                });

                const presenceMap = new Map();
                freshRows.forEach((r) => presenceMap.set(r.profile_id, r.last_seen_at));

                const result = (Array.isArray(profileRows) ? profileRows : [])
                  .filter((p) => p && !p.is_banned)
                  .map((p) => ({
                    uid: p.auth_user_id || String(p.profile_id),
                    profileId: p.profile_id,
                    displayName: p.display_name || p.login || "User",
                    login: p.login,
                    photoURL: p.photo_url || null,
                    accentRole: (Array.isArray(p.roles) && p.roles[0]) || null,
                    presence: {
                      lastSeenAt: presenceMap.get(p.profile_id) || new Date().toISOString()
                    }
                  }));

                cachedOnlineUsers = result;
                cachedOnlineUsersExpiresAt = now + 4000;
                return result;
              } catch (e) {
                return cachedOnlineUsers || [];
              }
            },

            getSiteOnlineCount: async () => {
              const list = await bridge.getSiteOnlineUsers();
              return list.length;
            },

            syncPresence: async (options = {}) => {
              const profileId = window.sakuraCurrentUserSnapshot?.profileId;
              if (profileId) {
                startPresenceHeartbeat(profileId);
                sendPresenceTouch(profileId, true);
              }
              return window.sakuraCurrentUserSnapshot || null;
            },

            logout: async () => {
              stopPresenceHeartbeat();
              await supabase.auth.signOut();
              publishUserSnapshot(null);
            },

            onAuthStateChanged: (callback) => {
              const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
                if (session?.user) {
                  const snap = await resolveUserSnapshot(session.user);
                  callback(snap);
                } else {
                  callback(publishUserSnapshot(null));
                }
                markAuthStateSettled();
              });

              // Initial check
              supabase.auth.getSession().then(async ({ data: { session } }) => {
                if (session?.user) {
                  const snap = await resolveUserSnapshot(session.user);
                  callback(snap);
                } else {
                  callback(publishUserSnapshot(null));
                }
                markAuthStateSettled();
              }).catch(() => {
                markAuthStateSettled();
              });

              return () => {
                subscription.unsubscribe();
              };
            }
          };

          window.sakuraFirebaseAuth = bridge;
          window.loginWithGoogle = bridge.loginWithGoogle;
          window.sakuraFirebaseRuntimeVersion = AUTH_RUNTIME_VERSION;

          window.dispatchEvent(
            new CustomEvent("sakura-auth-runtime-installed", {
              detail: { version: AUTH_RUNTIME_VERSION }
            })
          );
          window.dispatchEvent(new CustomEvent("sakura-auth-ready"));
        } catch (error) {
          console.error("Failed to start Supabase Auth runtime:", error);
          const message = error instanceof Error ? error.message : "Failed to initialize Auth.";
          window.sakuraFirebaseAuthError = message;
          markAuthStateSettled();
          window.dispatchEvent(new CustomEvent("sakura-auth-error", { detail: { message } }));
        }
      })();

      return startPromise;
    };

    window.sakuraStartFirebaseAuth = startFirebaseAuth;
    startFirebaseAuth();
  })();
`;

export default firebaseModuleScript;
