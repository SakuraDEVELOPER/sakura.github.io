"use client";

import { useState } from "react";
import { useLocaleText } from "@/lib/ui-locale";
import { SakuraIcon } from "./sakura-icon";

const FUNPAY_OFFER_URL = "https://funpay.com/lots/offer?id=67099133";
const FUNPAY_ICON_URL = "https://funpay.com/favicon.ico";
const OPEN_AUTH_MODAL_EVENT = "sakura-open-auth-modal";

export type TariffsBentoProps = {
  currentUser?: {
    uid?: string;
    isAnonymous?: boolean;
    hasClaimedTrial?: boolean;
    activationHistory?: Array<{ type?: string; code?: string }>;
    subscriptionUntil?: string | null;
  } | null;
  onClaimSuccess?: (result: { durationDays: number; newUntil: string }) => void;
  className?: string;
};

export function TariffsBento({
  currentUser,
  onClaimSuccess,
  className = "",
}: TariffsBentoProps) {
  const { t } = useLocaleText();
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimSuccessMessage, setClaimSuccessMessage] = useState<string | null>(null);
  const [claimErrorMessage, setClaimErrorMessage] = useState<string | null>(null);
  const [hasClaimedLocal, setHasClaimedLocal] = useState(false);

  const isLoggedIn = Boolean(currentUser && !currentUser.isAnonymous);

  const hasAlreadyClaimed = Boolean(
    hasClaimedLocal ||
    currentUser?.hasClaimedTrial === true ||
    currentUser?.activationHistory?.some(
      (item) => item.type === "trial" || item.code === "7-DAYS-TRIAL"
    )
  );

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

  return (
    <div className={`w-full ${className}`}>
      {/* Bento Grid: 3 Clean Tariffs */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* TARIFF 1: 7 DAYS (FREE TRIAL) */}
        <div className="relative flex flex-col justify-between rounded-[26px] border border-[#ffb7c5]/20 bg-gradient-to-b from-[#160d11] to-[#0c0709] p-7 shadow-[0_0_25px_rgba(255,183,197,0.06)] transition hover:border-[#ffb7c5]/45 hover:shadow-[0_0_35px_rgba(255,183,197,0.12)]">
          <div>
            <div className="flex items-center justify-between">
              <span className="rounded-full border border-[#ffb7c5]/30 bg-[#ffb7c5]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffb7c5]">
                {t("1 per account", "1 раз на аккаунт")}
              </span>
            </div>

            <div className="mt-5">
              <h3 className="text-2xl font-black uppercase tracking-tight text-white">
                {t("7 Days", "7 Дней")}
              </h3>
              <p className="mt-1.5 text-xs text-gray-400 leading-relaxed">
                {t(
                  "Full-featured trial to test Sakura before purchasing.",
                  "Полный ознакомительный доступ для тестирования чита."
                )}
              </p>
            </div>

            <div className="mt-5 flex items-baseline gap-2 border-b border-[#23151b] pb-5">
              <span className="text-4xl font-black text-[#ffb7c5]">0 ₽</span>
              <span className="font-mono text-xs text-gray-500 uppercase">
                / {t("free", "бесплатно")}
              </span>
            </div>

            <ul className="mt-5 space-y-3 text-xs text-gray-300">
              <li className="flex items-center gap-2.5">
                <span className="text-[#8ce5b2] font-bold">✓</span>
                <span>{t("All cheat features & combat scripts", "Все функции чита и боевые скрипты")}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="text-[#8ce5b2] font-bold">✓</span>
                <span>{t("Built-in Humanizer & safety layer", "Безопасный Humanizer и обход")}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="text-[#8ce5b2] font-bold">✓</span>
                <span>{t("Inventory Skinchanger & Maphack", "Скинченджер и мапхак")}</span>
              </li>
            </ul>
          </div>

          <div className="mt-7">
            {hasAlreadyClaimed ? (
              <button
                type="button"
                disabled
                className="w-full rounded-2xl border border-gray-800 bg-[#141012] py-3.5 text-xs font-bold uppercase tracking-[0.14em] text-gray-500 opacity-60 cursor-not-allowed"
              >
                {t("✓ Trial Already Claimed", "✓ Тест уже активирован")}
              </button>
            ) : isLoggedIn ? (
              <button
                type="button"
                onClick={handleClaimTrial}
                disabled={isClaiming}
                className="w-full rounded-2xl border border-[#ffb7c5]/50 bg-[#ffb7c5] py-3.5 text-xs font-bold uppercase tracking-[0.14em] text-black shadow-[0_0_24px_rgba(255,183,197,0.3)] transition hover:bg-white hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {isClaiming ? t("Activating...", "Активация...") : t("Claim 7 Days Free", "Получить 7 дней теста")}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenAuth}
                className="w-full rounded-2xl border border-[#ffb7c5]/40 bg-[#160d11] py-3.5 text-xs font-bold uppercase tracking-[0.14em] text-[#ffb7c5] shadow-[0_0_18px_rgba(255,183,197,0.15)] transition hover:border-[#ffb7c5] hover:bg-[#ffb7c5] hover:text-black hover:scale-[1.02] active:scale-95"
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

        {/* TARIFF 2: 30 DAYS (POPULAR / FUNPAY) */}
        <div className="relative flex flex-col justify-between rounded-[26px] border-2 border-[#ffb7c5] bg-[radial-gradient(ellipse_at_top,#26111b_0%,#10080c_80%)] p-7 shadow-[0_0_40px_rgba(255,183,197,0.22)] transition hover:shadow-[0_0_55px_rgba(255,183,197,0.32)]">
          {/* Top Popular Glow Ribbon */}
          <div className="absolute top-0 right-0 left-0 flex justify-center">
            <span className="rounded-b-xl bg-[#ffb7c5] px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-black shadow-[0_0_20px_rgba(255,183,197,0.5)]">
              ★ {t("Most Popular", "Хит продаж")}
            </span>
          </div>

          <div className="pt-2">
            <div className="mt-4 flex items-center justify-between">
              <h3 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                <span>{t("30 Days", "30 Дней")}</span>
                <SakuraIcon className="h-5 w-5 text-[#ffb7c5]" />
              </h3>
            </div>
            <p className="mt-1.5 text-xs text-gray-300 leading-relaxed">
              {t(
                "Optimal monthly subscription for active matchmaking.",
                "Оптимальный тариф для регулярной и комфортной игры."
              )}
            </p>

            <div className="mt-5 border-b border-[#28151f] pb-5">
              <span className="font-mono text-xs uppercase tracking-wider text-[#ffb7c5]">
                {t("Instant key delivery 24/7", "Моментальная автовыдача")}
              </span>
            </div>

            <ul className="mt-5 space-y-3 text-xs text-gray-200">
              <li className="flex items-center gap-2.5">
                <span className="text-[#8ce5b2] font-bold">✓</span>
                <span>{t("30 days of unlimited cheat access", "30 дней неограниченного доступа")}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="text-[#8ce5b2] font-bold">✓</span>
                <span>{t("Self-service subscription freeze feature", "Возможность заморозки подписки")}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="text-[#8ce5b2] font-bold">✓</span>
                <span>{t("Priority customer support in Discord", "Приоритетная поддержка в Discord")}</span>
              </li>
            </ul>
          </div>

          <div className="mt-7">
            <a
              href={FUNPAY_OFFER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-[#ffb7c5] bg-[#ffb7c5] py-3.5 text-xs font-black uppercase tracking-[0.14em] text-black shadow-[0_0_30px_rgba(255,183,197,0.4)] transition hover:bg-white hover:scale-[1.02] active:scale-95"
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

        {/* TARIFF 3: LIFETIME (SOON) */}
        <div className="relative flex flex-col justify-between rounded-[26px] border border-amber-500/25 bg-gradient-to-b from-[#18130a] to-[#0d0a06] p-7 shadow-[0_0_25px_rgba(245,158,11,0.06)] transition hover:border-amber-500/40">
          <div>
            <div className="flex items-center justify-between">
              <span className="rounded-full border border-amber-500/50 bg-amber-500/15 px-3 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-amber-300">
                SOON
              </span>
            </div>

            <div className="mt-5">
              <h3 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                <span>{t("Lifetime", "Навсегда")}</span>
                <SakuraIcon
                  className="h-5 w-5 text-amber-400"
                  stroke="#fbbf24"
                  fill="#f59e0b"
                />
              </h3>
              <p className="mt-1.5 text-xs text-gray-400 leading-relaxed">
                {t(
                  "Unlimited permanent access to all Sakura builds & updates.",
                  "Пожизненный неограниченный доступ ко всем обновлениям."
                )}
              </p>
            </div>

            <div className="mt-5 border-b border-[#251e11] pb-5">
              <span className="text-2xl font-black text-amber-300 uppercase">
                {t("Coming Soon", "Скоро")}
              </span>
            </div>

            <ul className="mt-5 space-y-3 text-xs text-gray-300">
              <li className="flex items-center gap-2.5">
                <span className="text-amber-400 font-bold">✓</span>
                <span>{t("Permanent access with zero recurring fees", "Постоянный доступ без продлений")}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="text-amber-400 font-bold">✓</span>
                <span>{t("All future Dota 2 patches & feature updates", "Все будущие патчи и обновления чита")}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="text-amber-400 font-bold">✓</span>
                <span>{t("Exclusive gold Lifetime badge in profile", "Золотой бейдж Lifetime в профиле")}</span>
              </li>
            </ul>
          </div>

          <div className="mt-7">
            <button
              type="button"
              disabled
              className="w-full rounded-2xl border border-amber-500/30 bg-[#161208] py-3.5 text-xs font-bold uppercase tracking-[0.14em] text-amber-400/60 opacity-80 cursor-not-allowed"
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
