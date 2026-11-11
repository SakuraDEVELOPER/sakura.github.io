"use client";

import { useState, useEffect } from "react";
import { useLocaleText } from "@/lib/ui-locale";
import { SakuraIcon } from "./sakura-icon";

const FUNPAY_OFFER_URL = "https://funpay.com/lots/offer?id=67099133";
const FUNPAY_ICON_URL = "https://funpay.com/favicon.ico";
const OPEN_AUTH_MODAL_EVENT = "sakura-open-auth-modal";
const TRIAL_CLAIMED_STORAGE_KEY = "sakura_trial_claimed";

export type TariffsBentoProps = {
  currentUser?: {
    uid?: string;
    isAnonymous?: boolean;
    hasClaimedTrial?: boolean;
    activationHistory?: Array<{ type?: string; code?: string }>;
    subscriptionUntil?: string | null;
    roles?: string[];
  } | null;
  onClaimSuccess?: (result: { durationDays: number; newUntil: string }) => void;
  className?: string;
  variant?: "grid" | "compact";
};

export function TariffsBento({
  currentUser,
  onClaimSuccess,
  className = "",
  variant = "grid",
}: TariffsBentoProps) {
  const { t } = useLocaleText();
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimSuccessMessage, setClaimSuccessMessage] = useState<string | null>(null);
  const [claimErrorMessage, setClaimErrorMessage] = useState<string | null>(null);
  const [hasClaimedLocal, setHasClaimedLocal] = useState(false);
  const [hasClaimedStorage, setHasClaimedStorage] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      // Clear legacy global un-keyed flag that poisoned all accounts in this browser
      window.localStorage.removeItem(TRIAL_CLAIMED_STORAGE_KEY);

      if (currentUser?.uid) {
        const userClaimed =
          window.localStorage.getItem(`${TRIAL_CLAIMED_STORAGE_KEY}_${currentUser.uid}`) === "true";
        setHasClaimedStorage(userClaimed);
      } else {
        setHasClaimedStorage(false);
      }
    } catch {
      setHasClaimedStorage(false);
    }
  }, [currentUser?.uid]);

  const isLoggedIn = Boolean(currentUser && !currentUser.isAnonymous);

  const hasActiveSubscription = Boolean(
    currentUser?.subscriptionUntil &&
      new Date(currentUser.subscriptionUntil).getTime() > Date.now()
  );

  const hasAlreadyClaimed = Boolean(
    hasClaimedLocal ||
    hasClaimedStorage ||
    currentUser?.hasClaimedTrial === true ||
    hasActiveSubscription ||
    currentUser?.roles?.some((r) => {
      const lower = String(r).toLowerCase().trim();
      return (
        lower === "test period" ||
        lower === "trial" ||
        lower === "subscriber" ||
        lower === "sub" ||
        lower === "lifetime"
      );
    }) ||
    currentUser?.activationHistory?.some(
      (item) => item.type === "trial" || item.code === "7-DAYS-TRIAL"
    )
  );

  // Sync to local storage for THIS user
  useEffect(() => {
    if ((hasClaimedLocal || currentUser?.hasClaimedTrial) && currentUser?.uid && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(`${TRIAL_CLAIMED_STORAGE_KEY}_${currentUser.uid}`, "true");
      } catch {}
    }
  }, [hasClaimedLocal, currentUser?.hasClaimedTrial, currentUser?.uid]);

  const handleOpenAuth = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent(OPEN_AUTH_MODAL_EVENT, {
        detail: { mode: "register" },
      })
    );
  };

  const handleClaimTrial = async () => {
    if (!isLoggedIn) {
      handleOpenAuth();
      return;
    }

    if (hasAlreadyClaimed) {
      setClaimErrorMessage(
        t(
          "You have already claimed your 7-day free trial on this account.",
          "Бесплатный 7-дневный тест уже был активирован на этом аккаунте."
        )
      );
      return;
    }

    if (typeof window === "undefined") return;
    const bridge = (window as any).sakuraFirebaseAuth;
    if (!bridge?.claimFreeTrial) {
      setClaimErrorMessage(
        t("Auth system is initializing. Please retry in a few seconds.", "Система авторизации загружается. Повторите попытку через пару секунд.")
      );
      return;
    }

    setIsClaiming(true);
    setClaimErrorMessage(null);
    setClaimSuccessMessage(null);

    try {
      const res = await bridge.claimFreeTrial();
      setHasClaimedLocal(true);
      setClaimSuccessMessage(
        t(
          "7-day trial activated successfully! Full access unlocked.",
          "7 дней бесплатного теста успешно активировано! Доступ к читу открыт."
        )
      );
      onClaimSuccess?.(res);
    } catch (err: any) {
      setClaimErrorMessage(
        err?.message ||
          t("Failed to claim free trial. Please try again.", "Не удалось активировать тест. Попробуйте снова.")
      );
    } finally {
      setIsClaiming(false);
    }
  };

  if (variant === "compact") {
    return (
      <div className={`w-full space-y-2.5 ${className}`}>
        {/* 1. Trial: 7 Days - Hides when already claimed */}
        {!hasAlreadyClaimed && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-sky-500/30 bg-gradient-to-r from-[#09151e] to-[#060b10] p-3.5 px-4 shadow-[0_0_15px_rgba(56,189,248,0.08)] transition hover:border-sky-500/50">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-500/40 bg-sky-500/15 text-sky-400">
                <SakuraIcon
                  className="h-5 w-5 text-sky-400"
                  stroke="#38bdf8"
                  fill="#0284c7"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black uppercase text-white tracking-wide">
                    {t("7 Days Test", "7 Дней Тест")}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">
                  {t("Full-featured trial access for new players", "Полный ознакомительный доступ для тестирования")}
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center">
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={handleClaimTrial}
                  disabled={isClaiming}
                  className="inline-flex items-center justify-center rounded-xl border border-sky-400/50 bg-sky-400 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-black shadow-[0_0_15px_rgba(56,189,248,0.3)] transition hover:bg-white hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                  {isClaiming ? t("Activating...", "Активация...") : t("Get 7 Days Free", "Получить тест")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenAuth}
                  className="inline-flex items-center justify-center rounded-xl border border-sky-500/40 bg-[#09151e] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-sky-400 transition hover:bg-sky-400 hover:text-black"
                >
                  {t("Login to Claim", "Войти и получить")}
                </button>
              )}
            </div>
          </div>
        )}

        {/* 2. Popular: 30 Days */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border-2 border-[#ffb7c5]/60 bg-gradient-to-r from-[#221019] via-[#150a10] to-[#0f070b] p-3.5 px-4 shadow-[0_0_25px_rgba(255,183,197,0.15)] transition hover:border-[#ffb7c5]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#ffb7c5]/50 bg-[#ffb7c5]/15 text-[#ffb7c5]">
              <SakuraIcon className="h-5 w-5 text-[#ffb7c5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black uppercase text-white tracking-wide">
                  {t("30 Days Access", "30 Дней Доступа")}
                </span>
              </div>
              <p className="text-[11px] text-gray-300">
                {t("Optimal plan • Instant key delivery 24/7", "Полный доступ • Моментальная автовыдача FunPay")}
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center">
            <a
              href={FUNPAY_OFFER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-[#ffb7c5] bg-[#ffb7c5] px-4 py-1.5 text-xs font-black uppercase tracking-wider text-black shadow-[0_0_18px_rgba(255,183,197,0.35)] transition hover:bg-white hover:scale-105 active:scale-95"
            >
              <img src={FUNPAY_ICON_URL} alt="FunPay" loading="lazy" decoding="async" className="h-3.5 w-3.5 rounded-sm" />
              <span>{t("Buy on FunPay", "Купить на FunPay")}</span>
            </a>
          </div>
        </div>

        {/* 3. Lifetime */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-[#19140b] to-[#0c0905] p-3.5 px-4 shadow-[0_0_15px_rgba(245,158,11,0.06)] transition hover:border-amber-500/50">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/15 text-amber-400">
              <SakuraIcon className="h-5 w-5 text-amber-400" stroke="#fbbf24" fill="#f59e0b" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black uppercase text-white tracking-wide">
                  {t("Lifetime Access", "Навсегда")}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                {t("Unlimited permanent access", "Пожизненный доступ")}
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center">
            <span className="inline-flex items-center rounded-xl border border-amber-500/30 bg-[#161208] px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-amber-400/60 cursor-not-allowed">
              {t("Coming Soon", "Скоро в продаже")}
            </span>
          </div>
        </div>

        {claimSuccessMessage && (
          <p className="mt-2 text-center text-xs text-[#8ce5b2] font-medium">
            ✓ {claimSuccessMessage}
          </p>
        )}
        {claimErrorMessage && (
          <p className="mt-2 text-center text-xs text-[#ff9aa9] font-medium">
            ⚠ {claimErrorMessage}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Bento Grid: Clean Tariffs */}
      <div className={`grid grid-cols-1 gap-4 ${hasAlreadyClaimed ? "md:grid-cols-2 max-w-4xl mx-auto" : "md:grid-cols-3"}`}>
        {/* TARIFF 1: 7 DAYS (FREE TRIAL) - Hides when already claimed */}
        {!hasAlreadyClaimed && (
          <div className="relative flex flex-col justify-between rounded-[22px] border border-sky-500/25 bg-gradient-to-b from-[#09151e] to-[#060b10] p-5 sm:p-6 shadow-[0_0_25px_rgba(56,189,248,0.06)] transition hover:border-sky-500/45 hover:shadow-[0_0_35px_rgba(56,189,248,0.12)]">
            <div>
              <div className="mt-4">
                <h3 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                  <span>{t("7 Days", "7 Дней")}</span>
                  <SakuraIcon
                    className="h-5 w-5 text-sky-400"
                    stroke="#38bdf8"
                    fill="#0284c7"
                  />
                </h3>
                <p className="mt-1 text-xs text-gray-400 leading-relaxed">
                  {t(
                    "Full-featured trial to test Sakura before purchasing.",
                    "Полный ознакомительный доступ для тестирования чита."
                  )}
                </p>
              </div>

              <div className="mt-4 flex items-baseline gap-2 border-b border-[#12222d] pb-4">
                <span className="text-3xl font-black text-sky-400">0 ₽</span>
                <span className="font-mono text-xs text-gray-500 uppercase">
                  / {t("free", "бесплатно")}
                </span>
              </div>

              <ul className="mt-4 space-y-2 text-xs text-gray-300">
                <li className="flex items-center gap-2">
                  <span className="text-sky-400 font-bold">✓</span>
                  <span>{t("All cheat features & combat scripts", "Все функции чита и боевые скрипты")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-sky-400 font-bold">✓</span>
                  <span>{t("Built-in Humanizer & safety layer", "Безопасный Humanizer и обход")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-sky-400 font-bold">✓</span>
                  <span>{t("Inventory Skinchanger & Maphack", "Скинченджер и мапхак")}</span>
                </li>
              </ul>
            </div>

            <div className="mt-5">
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={handleClaimTrial}
                  disabled={isClaiming}
                  className="w-full rounded-xl border border-sky-400/50 bg-sky-400 py-2.5 sm:py-3 text-xs font-bold uppercase tracking-[0.14em] text-black shadow-[0_0_24px_rgba(56,189,248,0.3)] transition hover:bg-white hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  {isClaiming ? t("Activating...", "Активация...") : t("Claim 7 Days Free", "Получить 7 дней теста")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenAuth}
                  className="w-full rounded-xl border border-sky-500/40 bg-[#09151e] py-2.5 sm:py-3 text-xs font-bold uppercase tracking-[0.14em] text-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.15)] transition hover:border-sky-400 hover:bg-sky-400 hover:text-black hover:scale-[1.02] active:scale-95"
                >
                  {t("Login to Claim Trial", "Войти и получить тест")}
                </button>
              )}

              {claimSuccessMessage && (
                <p className="mt-2 text-center text-xs text-[#8ce5b2] font-medium">
                  {claimSuccessMessage}
                </p>
              )}
              {claimErrorMessage && (
                <p className="mt-2 text-center text-xs text-[#ff9aa9] font-medium">
                  ⚠ {claimErrorMessage}
                </p>
              )}
            </div>
          </div>
        )}

        {/* TARIFF 2: 30 DAYS (POPULAR / FUNPAY) */}
        <div className="relative flex flex-col justify-between rounded-[22px] border-2 border-[#ffb7c5] bg-[radial-gradient(ellipse_at_top,#26111b_0%,#10080c_80%)] p-5 sm:p-6 shadow-[0_0_40px_rgba(255,183,197,0.22)] transition hover:shadow-[0_0_55px_rgba(255,183,197,0.32)]">
          <div className="pt-1">
            <div className="mt-3 flex items-center justify-between">
              <h3 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                <span>{t("30 Days", "30 Дней")}</span>
                <SakuraIcon className="h-5 w-5 text-[#ffb7c5]" />
              </h3>
            </div>
            <p className="mt-1 text-xs text-gray-300 leading-relaxed">
              {t(
                "Optimal monthly subscription for active matchmaking.",
                "Оптимальный тариф для регулярной и комфортной игры."
              )}
            </p>

            <div className="mt-4 border-b border-[#28151f] pb-4">
              <span className="font-mono text-xs uppercase tracking-wider text-[#ffb7c5]">
                {t("Instant key delivery 24/7", "Моментальная автовыдача")}
              </span>
            </div>

            <ul className="mt-4 space-y-2 text-xs text-gray-200">
              <li className="flex items-center gap-2">
                <span className="text-[#8ce5b2] font-bold">✓</span>
                <span>{t("30 days of unlimited cheat access", "30 дней неограниченного доступа")}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#8ce5b2] font-bold">✓</span>
                <span>{t("Self-service subscription freeze feature", "Возможность заморозки подписки")}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#8ce5b2] font-bold">✓</span>
                <span>{t("Priority customer support in Discord", "Приоритетная поддержка в Discord")}</span>
              </li>
            </ul>
          </div>

          <div className="mt-5">
            <a
              href={FUNPAY_OFFER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-[#ffb7c5] bg-[#ffb7c5] py-2.5 sm:py-3 text-xs font-black uppercase tracking-[0.14em] text-black shadow-[0_0_30px_rgba(255,183,197,0.4)] transition hover:bg-white hover:scale-[1.02] active:scale-95"
            >
              <img
                src={FUNPAY_ICON_URL}
                alt="FunPay"
                loading="lazy"
                decoding="async"
                className="h-4 w-4 rounded-sm"
              />
              <span>{t("Buy on FunPay", "Купить на FunPay")}</span>
            </a>
          </div>
        </div>

        {/* TARIFF 3: LIFETIME */}
        <div className="relative flex flex-col justify-between rounded-[22px] border border-amber-500/25 bg-gradient-to-b from-[#18130a] to-[#0d0a06] p-5 sm:p-6 shadow-[0_0_25px_rgba(245,158,11,0.06)] transition hover:border-amber-500/40">
          <div>
            <div className="mt-3">
              <h3 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                <span>{t("Lifetime", "Навсегда")}</span>
                <SakuraIcon
                  className="h-5 w-5 text-amber-400"
                  stroke="#fbbf24"
                  fill="#f59e0b"
                />
              </h3>
              <p className="mt-1 text-xs text-gray-400 leading-relaxed">
                {t(
                  "Unlimited permanent access to all Sakura builds & updates.",
                  "Пожизненный неограниченный доступ."
                )}
              </p>
            </div>

            <div className="mt-4 border-b border-[#251e11] pb-4">
              <span className="text-xl font-black text-amber-300 uppercase">
                {t("Coming Soon", "Скоро")}
              </span>
            </div>

            <ul className="mt-4 space-y-2 text-xs text-gray-300">
              <li className="flex items-center gap-2">
                <span className="text-amber-400 font-bold">✓</span>
                <span>{t("Permanent access with zero recurring fees", "Постоянный доступ без продлений")}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-amber-400 font-bold">✓</span>
                <span>{t("All future Dota 2 patches & feature updates", "Все будущие патчи и обновления чита")}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-amber-400 font-bold">✓</span>
                <span>{t("Exclusive gold Lifetime badge in profile", "Золотой бейдж Lifetime в профиле")}</span>
              </li>
            </ul>
          </div>

          <div className="mt-5">
            <button
              type="button"
              disabled
              className="w-full rounded-xl border border-amber-500/30 bg-[#161208] py-2.5 sm:py-3 text-xs font-bold uppercase tracking-[0.14em] text-amber-400/60 opacity-80 cursor-not-allowed"
            >
              {t("Coming Soon", "Скоро в продаже")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TariffsBento;
