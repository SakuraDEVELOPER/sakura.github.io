"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type UiLocale, useLocaleText } from "@/lib/ui-locale";
import { SakuraIcon } from "../sakura-icon";

type ChangeItem = {
  type: "new" | "improved" | "fixed";
  textEn: string;
  textRu: string;
};

type ChangelogEntry = {
  id: string;
  version: string;
  date: string;
  category: "cheat" | "loader" | "site" | "security";
  titleEn: string;
  titleRu: string;
  items: ChangeItem[];
  isCustom?: boolean;
};

const DEFAULT_CHANGELOG: ChangelogEntry[] = [
  {
    id: "v2026-11-09-tickets-history",
    version: "v2026.11.09",
    date: "2026-11-09",
    category: "site",
    titleEn: "Activation History, Referrals & Support Tickets",
    titleRu: "История активаций, Реферальная программа и Поддержка",
    items: [
      {
        type: "new",
        textEn: "Subscription activation and freeze history directly in the user profile card.",
        textRu: "История активаций промокодов, заморозок и продлений прямо в профиле пользователя.",
      },
      {
        type: "new",
        textEn: "Referral program: personal invite links and +3 bonus days for referred friends.",
        textRu: "Реферальная программа: персональные ссылки и +3 бонусных дня подписки за друзей.",
      },
      {
        type: "new",
        textEn: "Support ticket system with direct Discord webhook notifications and replies.",
        textRu: "Система тикетов поддержки с моментальными уведомлениями и ответами через Discord.",
      },
      {
        type: "improved",
        textEn: "Admin panel now shows list of users who activated each promo code.",
        textRu: "В админ-панели теперь отображаются пользователи, активировавшие каждый промокод.",
      },
    ],
  },
  {
    id: "v2026-11-08-promo-freeze",
    version: "v2026.11.08",
    date: "2026-11-08",
    category: "site",
    titleEn: "Promo Codes & Subscription Freeze Engine",
    titleRu: "Система промокодов и заморозки подписки",
    items: [
      {
        type: "new",
        textEn: "Admin promo code generator supporting customizable duration, usage limits and notes.",
        textRu: "Генератор промокодов в админ-панели с настройкой срока, лимита активаций и заметок.",
      },
      {
        type: "new",
        textEn: "Self-service subscription freeze for users with active subscriptions (pauses remaining time).",
        textRu: "Самостоятельная заморозка подписки для пользователей (сохранение оставшегося времени).",
      },
      {
        type: "improved",
        textEn: "Clean, emoji-free subscription overview card with Lifetime badge.",
        textRu: "Лаконичный дизайн карточки подписки без эмодзи с бейджем Lifetime.",
      },
      {
        type: "fixed",
        textEn: "Hardened Firestore security rules protecting admin roles and subscription data.",
        textRu: "Усиленные правила безопасности Firestore для защиты ролей и данных подписки.",
      },
    ],
  },
  {
    id: "v2026-10-09-loader-core",
    version: "v2026.10.09",
    date: "2026-10-09",
    category: "loader",
    titleEn: "SakuraLoader & SafeLauncher Core",
    titleRu: "Обновление SakuraLoader и ядра SafeLauncher",
    items: [
      {
        type: "new",
        textEn: "Modern SakuraLoader UI with real-time status indicators and fast launch.",
        textRu: "Современный интерфейс SakuraLoader с индикацией статуса и быстрым запуском.",
      },
      {
        type: "improved",
        textEn: "Cryptographic ECDSA lease verification for client-server authorization.",
        textRu: "Криптографическая проверка лицензий (ECDSA) при авторизации клиента.",
      },
      {
        type: "improved",
        textEn: "Sub-second client launch and Dota 2 process injection pipeline.",
        textRu: "Мгновенный запуск и внедрение чита в игровой процесс Dota 2.",
      },
    ],
  },
  {
    id: "v2026-09-15-humanizer",
    version: "v2026.09.15",
    date: "2026-09-15",
    category: "cheat",
    titleEn: "SDK Order Safety Layer (Humanizer)",
    titleRu: "Слой безопасного управления (Humanizer)",
    items: [
      {
        type: "new",
        textEn: "Unified Order Safety gateway for combat casts, items and unit actions.",
        textRu: "Единый шлюз безопасности приказов для способностей, предметов и юнитов.",
      },
      {
        type: "improved",
        textEn: "Manual user input preservation and latency compensation without artificial sleep pauses.",
        textRu: "Приоритет ручного ввода игрока и компенсация задержек без искусственных задержек.",
      },
      {
        type: "fixed",
        textEn: "Armlet abuse toggling safety and emergency cast reservation.",
        textRu: "Безопасное переключение Armlet и резервирование экстренных кастов.",
      },
    ],
  },
];

export default function ChangelogPage() {
  const { locale, t } = useLocaleText();
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [entries, setEntries] = useState<ChangelogEntry[]>(DEFAULT_CHANGELOG);
  const [isAdmin, setIsAdmin] = useState(false);

  // Admin New Entry Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newVersion, setNewVersion] = useState("");
  const [newCategory, setNewCategory] = useState<"cheat" | "loader" | "site" | "security">("site");
  const [newTitleEn, setNewTitleEn] = useState("");
  const [newTitleRu, setNewTitleRu] = useState("");
  const [newItemsText, setNewItemsText] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const runtime = (window as any).sakuraCurrentUserSnapshot;
    const roles: string[] = runtime?.roles || [];
    const hasAdmin = roles.some((r) =>
      ["root", "co-owner", "owner"].includes(String(r).trim().toLowerCase())
    );
    setIsAdmin(hasAdmin);

    // Try to load custom entries from Firestore if available
    try {
      const db = (window as any).firebaseFirestoreDb;
      const getDocs = (window as any).firebaseGetDocs;
      const collection = (window as any).firebaseCollection;
      if (db && getDocs && collection) {
        getDocs(collection(db, "changelog")).then((snapshot: any) => {
          const loaded: ChangelogEntry[] = [];
          snapshot.forEach((doc: any) => {
            loaded.push({ id: doc.id, ...doc.data(), isCustom: true });
          });
          if (loaded.length > 0) {
            loaded.sort((a, b) => b.date.localeCompare(a.date));
            setEntries([...loaded, ...DEFAULT_CHANGELOG]);
          }
        }).catch(() => {});
      }
    } catch (e) {}
  }, []);

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersion.trim() || !newTitleRu.trim()) {
      setPublishError(t("Version and title are required.", "Укажите версию и название."));
      return;
    }
    setIsPublishing(true);
    setPublishError(null);

    try {
      const parsedItems: ChangeItem[] = newItemsText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          let type: "new" | "improved" | "fixed" = "new";
          let clean = line;
          if (clean.startsWith("[FIX]") || clean.startsWith("[fix]")) {
            type = "fixed";
            clean = clean.replace(/^\[(FIX|fix)\]\s*/, "");
          } else if (clean.startsWith("[IMP]") || clean.startsWith("[imp]")) {
            type = "improved";
            clean = clean.replace(/^\[(IMP|imp)\]\s*/, "");
          } else if (clean.startsWith("[NEW]") || clean.startsWith("[new]")) {
            type = "new";
            clean = clean.replace(/^\[(NEW|new)\]\s*/, "");
          }
          return {
            type,
            textEn: clean,
            textRu: clean,
          };
        });

      const entry: ChangelogEntry = {
        id: "log_" + Date.now(),
        version: newVersion.trim(),
        date: new Date().toISOString().slice(0, 10),
        category: newCategory,
        titleEn: newTitleEn.trim() || newTitleRu.trim(),
        titleRu: newTitleRu.trim(),
        items: parsedItems.length > 0 ? parsedItems : [{ type: "new", textEn: newTitleEn || newTitleRu, textRu: newTitleRu }],
        isCustom: true,
      };

      // Try save to Firestore
      try {
        const db = (window as any).firebaseFirestoreDb;
        const setDoc = (window as any).firebaseSetDoc;
        const doc = (window as any).firebaseDoc;
        const collection = (window as any).firebaseCollection;
        if (db && setDoc && doc && collection) {
          await setDoc(doc(collection(db, "changelog"), entry.id), entry);
        }
      } catch (err) {}

      setEntries([entry, ...entries]);
      setIsModalOpen(false);
      setNewVersion("");
      setNewTitleEn("");
      setNewTitleRu("");
      setNewItemsText("");
    } catch (err: any) {
      setPublishError(err?.message || "Failed to publish entry");
    } finally {
      setIsPublishing(false);
    }
  };

  const filteredEntries = entries.filter((entry) => {
    if (activeCategory === "all") return true;
    return entry.category === activeCategory;
  });

  const categoryLabel = (cat: string) => {
    switch (cat) {
      case "cheat":
        return t("Dota 2 Cheat", "Чит Dota 2");
      case "loader":
        return t("Sakura Loader", "Лоадер");
      case "site":
        return t("Website", "Сайт");
      case "security":
        return t("Security", "Безопасность");
      default:
        return cat;
    }
  };

  const typeBadge = (type: ChangeItem["type"]) => {
    switch (type) {
      case "new":
        return (
          <span className="rounded-full bg-[#8ce5b2]/10 border border-[#8ce5b2]/30 px-2 py-0.5 text-[9px] font-bold text-[#8ce5b2] tracking-wider uppercase">
            {t("NEW", "НОВОЕ")}
          </span>
        );
      case "improved":
        return (
          <span className="rounded-full bg-[#38bdf8]/10 border border-[#38bdf8]/30 px-2 py-0.5 text-[9px] font-bold text-[#7dd3fc] tracking-wider uppercase">
            {t("IMP", "УЛУЧШЕНО")}
          </span>
        );
      case "fixed":
        return (
          <span className="rounded-full bg-[#ffb7c5]/10 border border-[#ffb7c5]/30 px-2 py-0.5 text-[9px] font-bold text-[#ffb7c5] tracking-wider uppercase">
            {t("FIX", "ИСПРАВЛЕНО")}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#070708] text-white">
      {/* Background Glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,rgba(255,183,197,0.08),transparent_60%)]" />

      {/* Header Navigation */}
      <header className="relative z-20 border-b border-[#1b1517] bg-[#0c090a]/90 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#ffb7c5]/40 bg-[#160d11] p-1 shadow-[0_0_18px_rgba(255,183,197,0.25)]">
              <SakuraIcon className="h-full w-full" />
            </span>
            <span className="text-lg font-black uppercase tracking-tight text-[#ffb7c5]">
              Sakura
            </span>
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-full border border-[#2a2a2a] bg-[#101010] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-300 transition hover:border-[#4a4a4a] hover:text-white"
            >
              Home
            </Link>
            <span className="rounded-full border border-[#ffb7c5]/40 bg-[#ffb7c5]/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ffb7c5]">
              {t("Changelog", "Патчноуты")}
            </span>
            <Link
              href="/profile"
              className="rounded-full border border-[#2b1b1e] bg-[#1a1012] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ffb7c5] transition hover:border-[#ffb7c5]/45 hover:text-white"
            >
              {t("Profile", "Профиль")}
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 mx-auto max-w-4xl px-4 py-12">
        {/* Title & Description */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-[#1f1619] pb-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#ffb7c5]">
              {t("Updates & Releases", "Обновления и релизы")}
            </p>
            <h1 className="mt-2 flex items-center gap-3 text-3xl sm:text-4xl font-black uppercase tracking-tight text-white">
              <SakuraIcon className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 drop-shadow-[0_0_12px_rgba(255,183,197,0.45)]" />
              <span>{t("Sakura Changelog", "Патчноуты Sakura")}</span>
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              {t(
                "Track the latest improvements, fixes, and features across the Sakura ecosystem.",
                "История всех обновлений чита, лоадера и веб-платформы Sakura."
              )}
            </p>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-[#ffb7c5]/40 bg-[#ffb7c5] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-black shadow-[0_0_24px_rgba(255,183,197,0.25)] transition hover:bg-white"
            >
              <SakuraIcon className="h-4 w-4 shrink-0" />
              <span>+ {t("Add News", "Добавить новость")}</span>
            </button>
          )}
        </div>

        {/* Filter Categories */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {[
            { id: "all", label: t("All Updates", "Все обновления") },
            { id: "cheat", label: t("Dota 2 Cheat", "Чит Dota 2") },
            { id: "loader", label: t("Sakura Loader", "Лоадер") },
            { id: "site", label: t("Website", "Сайт") },
            { id: "security", label: t("Security", "Безопасность") },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.12em] transition ${
                activeCategory === cat.id
                  ? "border border-[#ffb7c5]/60 bg-[#ffb7c5] text-black shadow-[0_0_16px_rgba(255,183,197,0.2)]"
                  : "border border-[#23171b] bg-[#120b0e] text-gray-400 hover:border-[#ffb7c5]/35 hover:text-white"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Changelog Entries Feed */}
        <div className="mt-8 space-y-6">
          {filteredEntries.map((entry) => (
            <article
              key={entry.id}
              className="rounded-[28px] border border-[#23171b] bg-[#0d090b] p-6 sm:p-7 shadow-[0_0_40px_rgba(255,183,197,0.04)] transition hover:border-[#351e26]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1a1114] pb-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-black text-white">
                    {entry.version}
                  </span>
                  <span className="rounded-full border border-[#3a2028] bg-[#160d11] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#ffb7c5]">
                    {categoryLabel(entry.category)}
                  </span>
                </div>
                <time className="font-mono text-xs text-gray-500">
                  {new Date(entry.date).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </time>
              </div>

              <h2 className="mt-4 text-lg font-bold text-white">
                {locale === "ru" ? entry.titleRu : entry.titleEn}
              </h2>

              <ul className="mt-4 space-y-2.5">
                {entry.items.map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-sm text-gray-300">
                    <span className="shrink-0 mt-0.5">{typeBadge(item.type)}</span>
                    <span className="leading-relaxed">
                      {locale === "ru" ? item.textRu : item.textEn}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </main>

      {/* Admin Add Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-[28px] border border-[#2f1b23] bg-[#0f0a0d] p-6 shadow-[0_0_60px_rgba(255,183,197,0.15)]">
            <div className="flex items-center justify-between border-b border-[#201519] pb-4">
              <h3 className="text-base font-bold text-white uppercase tracking-tight">
                {t("Add Changelog Entry", "Добавить новость")}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEntry} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-400 mb-1">
                    {t("Version (e.g. v2.4.1)", "Версия (напр. v2.4.1)")}
                  </label>
                  <input
                    type="text"
                    required
                    value={newVersion}
                    onChange={(e) => setNewVersion(e.target.value)}
                    placeholder="v2026.11.09"
                    className="w-full rounded-xl border border-[#2d1b22] bg-[#140d10] px-3 py-2 text-xs text-white outline-none focus:border-[#ffb7c5]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-400 mb-1">
                    {t("Category", "Категория")}
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full rounded-xl border border-[#2d1b22] bg-[#140d10] px-3 py-2 text-xs text-white outline-none focus:border-[#ffb7c5]"
                  >
                    <option value="site">{t("Website", "Сайт")}</option>
                    <option value="cheat">{t("Dota 2 Cheat", "Чит")}</option>
                    <option value="loader">{t("Sakura Loader", "Лоадер")}</option>
                    <option value="security">{t("Security", "Безопасность")}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-gray-400 mb-1">
                  {t("Title (RU)", "Заголовок (RU)")}
                </label>
                <input
                  type="text"
                  required
                  value={newTitleRu}
                  onChange={(e) => setNewTitleRu(e.target.value)}
                  placeholder="Обновление защиты и функций"
                  className="w-full rounded-xl border border-[#2d1b22] bg-[#140d10] px-3 py-2 text-xs text-white outline-none focus:border-[#ffb7c5]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-gray-400 mb-1">
                  {t("Title (ENG)", "Заголовок (ENG)")}
                </label>
                <input
                  type="text"
                  value={newTitleEn}
                  onChange={(e) => setNewTitleEn(e.target.value)}
                  placeholder="Protection & feature update"
                  className="w-full rounded-xl border border-[#2d1b22] bg-[#140d10] px-3 py-2 text-xs text-white outline-none focus:border-[#ffb7c5]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-gray-400 mb-1">
                  {t("Changes (1 per line, [NEW], [IMP], [FIX])", "Изменения (по 1 в строке, теги [NEW], [IMP], [FIX])")}
                </label>
                <textarea
                  rows={4}
                  value={newItemsText}
                  onChange={(e) => setNewItemsText(e.target.value)}
                  placeholder={"[NEW] Добавлена новая функция\n[IMP] Улучшена стабильность инджектора\n[FIX] Исправлен вылет при паузе"}
                  className="w-full rounded-xl border border-[#2d1b22] bg-[#140d10] px-3 py-2 text-xs text-white outline-none focus:border-[#ffb7c5]"
                />
              </div>

              {publishError && (
                <p className="text-xs text-[#ff9aa9]">{publishError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full border border-[#2d1b22] px-4 py-2 text-xs text-gray-400 hover:text-white"
                >
                  {t("Cancel", "Отмена")}
                </button>
                <button
                  type="submit"
                  disabled={isPublishing}
                  className="rounded-full border border-[#ffb7c5]/40 bg-[#ffb7c5] px-5 py-2 text-xs font-bold text-black transition hover:bg-white disabled:opacity-50"
                >
                  {isPublishing ? t("Publishing...", "Публикуем...") : t("Publish", "Опубликовать")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
