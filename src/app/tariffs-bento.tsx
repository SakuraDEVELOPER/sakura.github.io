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
  compact?: boolean;
};

export function TariffsBento({
  currentUser,
  onClaimSuccess,
  className = "",
  compact = false,
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
      {/* Bento Grid: 3 Tariffs */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* TARIFF 1: 7 DAYS (FREE TRIAL) */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-[26px] border border-[#ffb7c5]/25 bg-gradient-to-b from-[#180e13] to-[#0f090c] p-6 shadow-[0_0_25px_rgba(255,183,197,0.08)] transition hover:border-[#ffb7c5]/50 hover:shadow-[0_0_35px_rgba(255,183,197,0.15)]">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full border border-[#ffb7c5]/35 bg-[#ffb7c5]/10 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#ffb7c5]">
                {t("1 per account", "1 раз на аккаунт")}
              </span>
              <span className="font-mono text-xs font-bold text-gray-400">
                {t("Free Trial", "Тест")}
              </span>
            </div>

            <div className="mt-4">
              <h3 className="text-2xl font-black uppercase tracking-tight text-white">
                {t("7 Days", "7 Дней")}
              </h3>
              <p className="mt-1 text-xs text-gray-400">
                {t(
                  "Full-featured trial to test Sakura before purchasing.",
                  "Полный ознакомительный доступ для тестирования чита."
                )}
              </p>
            </div>

            <div className="mt-4 flex items-baseline gap-2 border-b border-[#24161d] pb-4">
              <span className="text-3xl font-black text-[#ffb7c5]">0 ₽</span>
              <span className="font-mono text-xs text-gray-500 uppercase">
                / {t("free", "бесплатно")}
              </span>
            </div>

            <ul className="mt-4 space-y-2.5 text-xs text-gray-300">
              <li className="flex items-center gap-2">
                <span className="text-[#8ce5b2] font-bold">✓</span>
                <span>{t("All cheat features & combat scripts", "Все функции чита и боевые скрипты")}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#8ce5b2] font-bold">✓</span>
                <span>{t("Built-in Humanizer & safety layer", "Безопасный Humanizer и обход")}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#8ce5b2] font-bold">✓</span>
                <span>{t("Inventory Skinchanger & Maphack", "Скинченджер и мапхак")}</span>
              </li>
              <li className="flex items-center gap-2 text-gray-400">
                <span className="text-[#ffb7c5] font-bold">•</span>
                <span>{t("One-time activation per player", "Однократная активация на игрока")}</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-2">
            {hasAlreadyClaimed ? (
              <button
                type="button"
                disabled
                className="w-full rounded-2xl border border-gray-700/50 bg-[#151214] py-3 text-xs font-bold uppercase tracking-[0.14em] text-gray-400 opacity-70 cursor-not-allowed"
              >
                {t("✓ Trial Already Claimed", "✓ Тест уже активирован")}
              </button>
            ) : isLoggedIn ? (
              <button
                type="button"
                onClick={handleClaimTrial}
                disabled={isClaiming}
                className="w-full rounded-2xl border border-[#ffb7c5]/50 bg-[#ffb7c5] py-3 text-xs font-bold uppercase tracking-[0.14em] text-black shadow-[0_0_24px_rgba(255,183,197,0.3)] transition hover:bg-white hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {isClaiming ? t("Activating...", "Активация...") : t("Claim 7 Days Free", "Получить 7 дней теста")}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenAuth}
                className="w-full rounded-2xl border border-[#ffb7c5]/40 bg-[#160d11] py-3 text-xs font-bold uppercase tracking-[0.14em] text-[#ffb7c5] shadow-[0_0_18px_rgba(255,183,197,0.15)] transition hover:border-[#ffb7c5] hover:bg-[#ffb7c5] hover:text-black hover:scale-[1.02] active:scale-95"
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
        <div className="relative flex flex-col justify-between overflow-hidden rounded-[26px] border-2 border-[#ffb7c5] bg-[radial-gradient(ellipse_at_top,#2a131f_0%,#12090e_75%)] p-6 shadow-[0_0_40px_rgba(255,183,197,0.22)] transition hover:shadow-[0_0_55px_rgba(255,183,197,0.3)]">
          {/* Top Popular Glow Ribbon */}
          <div className="absolute top-0 right-0 left-0 flex justify-center">
            <span className="rounded-b-xl bg-[#ffb7c5] px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-black shadow-[0_0_20px_rgba(255,183,197,0.5)]">
              ★ {t("Most Popular", "Хит продаж")}
            </span>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between gap-2 mt-2">
              <span className="rounded-full border border-[#ffb7c5]/40 bg-[#ffb7c5]/15 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#ffb7c5]">
                {t("Full Access", "Полный доступ")}
              </span>
              <span className="flex items-center gap-1 font-mono text-xs font-bold text-[#8ce5b2]">
                <span>●</span> {t("Auto Delivery", "Автовыдача")}
              </span>
            </div>

            <div className="mt-4">
              <h3 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                <span>{t("30 Days", "30 Дней")}</span>
                <SakuraIcon className="h-5 w-5 text-[#ffb7c5]" />
              </h3>
              <p className="mt-1 text-xs text-gray-300">
                {t(
                  "Optimal monthly subscription for active matchmaking.",
                  "Оптимальный тариф для регулярной и комфортной игры."
                )}
              </p>
            </div>

            <div className="mt-4 flex items-baseline gap-2 border-b border-[#2b1722] pb-4">
              <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                FunPay:
              </span>
              <span className="font-mono text-xs text-[#ffb7c5]">
                {t("Instant key delivery 24/7", "Моментальное получение ключа")}
              </span>
            </div>

            <ul className="mt-4 space-y-2.5 text-xs text-gray-200">
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
                <span>{t("Automated key activation on profile page", "Быстрая активация ключа в профиле")}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#8ce5b2] font-bold">✓</span>
                <span>{t("Priority customer support in Discord", "Приоритетная поддержка в Discord")}</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-2">
            <a
              href={FUNPAY_OFFER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-[#ffb7c5] bg-[#ffb7c5] py-3 text-xs font-black uppercase tracking-[0.14em] text-black shadow-[0_0_30px_rgba(255,183,197,0.4)] transition hover:bg-white hover:scale-[1.02] active:scale-95"
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
            <p className="mt-2 text-center font-mono text-[10px] text-gray-400">
              ✓ {t("Verified FunPay seller", "Проверенный продавец • 100% гарантия")}
            </p>
          </div>
        </div>

        {/* TARIFF 3: LIFETIME (SOON) */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-[26px] border border-amber-500/25 bg-gradient-to-b from-[#19150d] to-[#0e0c08] p-6 shadow-[0_0_25px_rgba(245,158,11,0.06)] transition hover:border-amber-500/40">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-amber-300">
                {t("Permanent", "Бессрочно")}
              </span>
              <span className="rounded-full border border-amber-500/50 bg-amber-500/20 px-2.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-amber-300 animate-pulse">
                SOON
              </span>
            </div>

            <div className="mt-4">
              <h3 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                <span>{t("Lifetime", "Навсегда")}</span>
                <span className="text-amber-400 text-lg">👑</span>
              </h3>
              <p className="mt-1 text-xs text-gray-400">
                {t(
                  "Unlimited permanent access to all Sakura builds & updates.",
                  "Пожизненный неограниченный доступ ко всем обновлениям."
                )}
              </p>
            </div>

            <div className="mt-4 flex items-baseline gap-2 border-b border-[#272115] pb-4">
              <span className="text-2xl font-black text-amber-300 uppercase">
                {t("Coming Soon", "Скоро")}
              </span>
              <span className="font-mono text-xs text-gray-500">
                / {t("one-time", "разовая оплата")}
              </span>
            </div>

            <ul className="mt-4 space-y-2.5 text-xs text-gray-300">
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
              <li className="flex items-center gap-2">
                <span className="text-amber-400 font-bold">✓</span>
                <span>{t("Private VIP support & feature requests", "Прямой контакт и VIP-поддержка")}</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-2">
            <button
              type="button"
              disabled
              className="w-full rounded-2xl border border-amber-500/30 bg-[#161209] py-3 text-xs font-bold uppercase tracking-[0.14em] text-amber-400/60 opacity-80 cursor-not-allowed"
            >
              {t("Coming Soon", "Скоро в продаже")}
            </button>
            <p className="mt-2 text-center font-mono text-[10px] text-gray-500">
              {t("LZT & crypto payment integration soon", "Оплата через LZT и сайт будет доступна позже")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TariffsBento;
