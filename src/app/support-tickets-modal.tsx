"use client";

import { useEffect, useState } from "react";
import { type UiLocale, useLocaleText } from "@/lib/ui-locale";
import { SakuraIcon } from "./sakura-icon";

export type TicketMessage = {
  id: string;
  sender: "user" | "support";
  authorLogin: string;
  text: string;
  timestamp: string;
};

export type SupportTicket = {
  id: string;
  authorUid: string;
  authorProfileId: number | null;
  authorLogin: string;
  category: "payment" | "loader" | "cheat" | "other";
  contact: string;
  status: "open" | "answered" | "closed";
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
};

// Default Discord Webhook URL can be stored or overridden
const DEFAULT_DISCORD_WEBHOOK_KEY = "sakura_discord_webhook_url";

export default function SupportTicketsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { locale, t } = useLocaleText();
  const [activeTab, setActiveTab] = useState<"new" | "my" | "admin">("new");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form State
  const [category, setCategory] = useState<"payment" | "loader" | "cheat" | "other">("loader");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Tickets List & Active Ticket State
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Admin Discord Webhook Config State
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const user = (window as any).sakuraCurrentUserSnapshot;
    setCurrentUser(user);
    const roles: string[] = user?.roles || [];
    const adminCheck = roles.some((r) =>
      ["root", "co-owner", "owner"].includes(String(r).trim().toLowerCase())
    );
    setIsAdmin(adminCheck);

    const savedWebhook = window.localStorage.getItem(DEFAULT_DISCORD_WEBHOOK_KEY) || "";
    setDiscordWebhookUrl(savedWebhook);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadTickets();
    }
  }, [isOpen, activeTab]);

  const loadTickets = async () => {
    if (typeof window === "undefined") return;
    setIsLoadingTickets(true);
    try {
      const db = (window as any).firebaseFirestoreDb;
      const getDocs = (window as any).firebaseGetDocs;
      const collection = (window as any).firebaseCollection;
      const query = (window as any).firebaseQuery;
      const where = (window as any).firebaseWhere;

      if (!db || !getDocs || !collection) {
        setIsLoadingTickets(false);
        return;
      }

      let q = collection(db, "supportTickets");
      if (activeTab === "my" && currentUser?.uid && !isAdmin) {
        q = query(collection(db, "supportTickets"), where("authorUid", "==", currentUser.uid));
      }

      const snap = await getDocs(q);
      const list: SupportTicket[] = [];
      snap.forEach((d: any) => {
        list.push({ id: d.id, ...d.data() });
      });
      list.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
      setTickets(list);

      // Keep selected ticket refreshed if open
      if (selectedTicket) {
        const refreshed = list.find((item) => item.id === selectedTicket.id);
        if (refreshed) setSelectedTicket(refreshed);
      }
    } catch (e) {
      console.warn("Could not load support tickets:", e);
    } finally {
      setIsLoadingTickets(false);
    }
  };

  const sendDiscordNotification = async (ticket: SupportTicket, initialText: string) => {
    const webhook = discordWebhookUrl || (typeof window !== "undefined" ? window.localStorage.getItem(DEFAULT_DISCORD_WEBHOOK_KEY) : null);
    if (!webhook || !webhook.startsWith("http")) return;

    try {
      const categoryNames: Record<string, string> = {
        payment: "Оплата / Промокоды",
        loader: "Запуск / SakuraLoader",
        cheat: "Чит / Функции",
        other: "Общий вопрос",
      };

      const payload = {
        username: "Sakura Support Bot",
        embeds: [
          {
            title: `🌸 Новый тикет #${ticket.id.slice(-6)} [${categoryNames[ticket.category] || ticket.category}]`,
            description: initialText,
            color: 0xffb7c5,
            fields: [
              {
                name: "Пользователь",
                value: `@${ticket.authorLogin} (ID #${ticket.authorProfileId ?? "?"})`,
                inline: true,
              },
              {
                name: "Контакт для связи",
                value: ticket.contact || "Не указан",
                inline: true,
              },
              {
                name: "Статус",
                value: "Открыт",
                inline: true,
              },
            ],
            footer: {
              text: "Sakura Cheat Support System • " + new Date().toISOString().slice(0, 19).replace("T", " "),
            },
          },
        ],
      };

      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn("Failed to dispatch Discord webhook:", err);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setSubmitError(t("Please enter your message.", "Введите текст сообщения."));
      return;
    }
    if (!currentUser || currentUser.isAnonymous) {
      setSubmitError(t("Sign in to your account first.", "Войдите в аккаунт, чтобы создать тикет."));
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const db = (window as any).firebaseFirestoreDb;
      const setDoc = (window as any).firebaseSetDoc;
      const doc = (window as any).firebaseDoc;
      const collection = (window as any).firebaseCollection;

      const ticketId = "ticket_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
      const initialMessage: TicketMessage = {
        id: "msg_" + Date.now(),
        sender: "user",
        authorLogin: currentUser.login || `user_${currentUser.profileId || ""}`,
        text: message.trim(),
        timestamp: new Date().toISOString(),
      };

      const newTicket: SupportTicket = {
        id: ticketId,
        authorUid: currentUser.uid,
        authorProfileId: currentUser.profileId ?? null,
        authorLogin: currentUser.login || "user",
        category,
        contact: contact.trim(),
        status: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [initialMessage],
      };

      if (db && setDoc && doc && collection) {
        await setDoc(doc(collection(db, "supportTickets"), ticketId), newTicket);
      }

      void sendDiscordNotification(newTicket, message.trim());

      setSubmitSuccess(
        t("Ticket created successfully! Support will respond shortly.", "Тикет успешно отправлен! Поддержка ответит вам в ближайшее время.")
      );
      setMessage("");
      setContact("");
      setTickets([newTicket, ...tickets]);
      setSelectedTicket(newTicket);
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to create ticket");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    setIsSendingReply(true);

    try {
      const db = (window as any).firebaseFirestoreDb;
      const setDoc = (window as any).firebaseSetDoc;
      const doc = (window as any).firebaseDoc;
      const collection = (window as any).firebaseCollection;

      const reply: TicketMessage = {
        id: "msg_" + Date.now(),
        sender: isAdmin ? "support" : "user",
        authorLogin: currentUser?.login || (isAdmin ? "Sakura Support" : "user"),
        text: replyText.trim(),
        timestamp: new Date().toISOString(),
      };

      const updatedMessages = [...selectedTicket.messages, reply];
      const nextStatus = isAdmin ? "answered" : "open";

      const updateData = {
        messages: updatedMessages,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };

      if (db && setDoc && doc && collection) {
        await setDoc(doc(collection(db, "supportTickets"), selectedTicket.id), updateData, { merge: true });
      }

      const updatedTicket: SupportTicket = {
        ...selectedTicket,
        messages: updatedMessages,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };

      setSelectedTicket(updatedTicket);
      setTickets(tickets.map((t) => (t.id === updatedTicket.id ? updatedTicket : t)));
      setReplyText("");
    } catch (err) {
      console.warn("Failed to send reply:", err);
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;
    try {
      const db = (window as any).firebaseFirestoreDb;
      const setDoc = (window as any).firebaseSetDoc;
      const doc = (window as any).firebaseDoc;
      const collection = (window as any).firebaseCollection;

      if (db && setDoc && doc && collection) {
        await setDoc(doc(collection(db, "supportTickets"), selectedTicket.id), {
          status: "closed",
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }

      const closed = { ...selectedTicket, status: "closed" as const };
      setSelectedTicket(closed);
      setTickets(tickets.map((t) => (t.id === closed.id ? closed : t)));
    } catch (err) {}
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative flex flex-col w-full max-w-2xl max-h-[88vh] overflow-hidden rounded-[32px] border border-[#2e1c23] bg-[#0c080a] shadow-[0_0_80px_rgba(255,183,197,0.12)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#211519] bg-[radial-gradient(ellipse_at_top,rgba(255,183,197,0.12),transparent_70%)] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#ffb7c5]/35 bg-[#170e12] p-1 shadow-[0_0_16px_rgba(255,183,197,0.2)]">
              <SakuraIcon className="h-full w-full" />
            </span>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-tight">
                {t("Sakura Support", "Служба поддержки Sakura")}
              </h2>
              <p className="text-[10px] font-mono uppercase text-gray-500 tracking-[0.2em]">
                {t("Tickets & Help Desk", "Тикеты и помощь")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#2b1820] bg-[#140c10] text-gray-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#1b1216] px-6 py-2.5 bg-[#0a0708]">
          <button
            type="button"
            onClick={() => { setActiveTab("new"); setSelectedTicket(null); }}
            className={`rounded-full px-3.5 py-1 text-xs font-bold transition ${
              activeTab === "new" && !selectedTicket
                ? "bg-[#ffb7c5] text-black"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t("New Ticket", "Новое обращение")}
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("my"); setSelectedTicket(null); }}
            className={`rounded-full px-3.5 py-1 text-xs font-bold transition ${
              activeTab === "my"
                ? "bg-[#ffb7c5] text-black"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t("My Tickets", "Мои тикеты")}
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => { setActiveTab("admin"); setSelectedTicket(null); }}
              className={`rounded-full px-3.5 py-1 text-xs font-bold transition ${
                activeTab === "admin"
                  ? "bg-[#ffb7c5] text-black"
                  : "text-[#ffb7c5]/70 hover:text-white"
              }`}
            >
              {t("Admin Inbox", "Входящие (Админ)")} ({tickets.length})
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedTicket ? (
            /* Selected Ticket Dialogue View */
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#211519] pb-3">
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="text-xs text-[#ffb7c5] hover:underline flex items-center gap-1 font-bold"
                >
                  ← {t("Back to list", "Назад к списку")}
                </button>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    selectedTicket.status === "open"
                      ? "bg-[#38bdf8]/10 border border-[#38bdf8]/40 text-[#7dd3fc]"
                      : selectedTicket.status === "answered"
                      ? "bg-[#8ce5b2]/10 border border-[#8ce5b2]/40 text-[#8ce5b2]"
                      : "bg-gray-800 text-gray-400"
                  }`}>
                    {selectedTicket.status === "open"
                      ? t("Open", "Открыт")
                      : selectedTicket.status === "answered"
                      ? t("Answered", "Отвечен")
                      : t("Closed", "Закрыт")}
                  </span>
                  {selectedTicket.status !== "closed" && (
                    <button
                      type="button"
                      onClick={handleCloseTicket}
                      className="rounded-full border border-gray-700 bg-black/40 px-3 py-0.5 text-[10px] text-gray-400 hover:text-white"
                    >
                      {t("Close Ticket", "Закрыть тикет")}
                    </button>
                  )}
                </div>
              </div>

              {/* Messages Thread */}
              <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                {selectedTicket.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-2xl p-4 text-xs ${
                      msg.sender === "support"
                        ? "border border-[#ffb7c5]/30 bg-[#1e0f15] ml-4 text-white shadow-[0_0_20px_rgba(255,183,197,0.06)]"
                        : "border border-[#23171b] bg-[#120b0e] mr-4 text-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1.5">
                      <span className="font-bold font-mono text-[#ffb7c5]">
                        {msg.sender === "support" ? `🌸 Support (@${msg.authorLogin})` : `@${msg.authorLogin}`}
                      </span>
                      <span>
                        {new Date(msg.timestamp).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  </div>
                ))}
              </div>

              {/* Reply Box */}
              {selectedTicket.status !== "closed" ? (
                <div className="pt-2 border-t border-[#211519] flex gap-2">
                  <textarea
                    rows={2}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={t("Type your reply...", "Введите ваш ответ...")}
                    className="flex-1 rounded-xl border border-[#2d1b22] bg-[#140d10] px-3.5 py-2 text-xs text-white outline-none focus:border-[#ffb7c5]"
                  />
                  <button
                    type="button"
                    onClick={handleSendReply}
                    disabled={isSendingReply || !replyText.trim()}
                    className="shrink-0 rounded-xl border border-[#ffb7c5]/40 bg-[#ffb7c5] px-5 py-2 text-xs font-bold text-black transition hover:bg-white disabled:opacity-50"
                  >
                    {isSendingReply ? "..." : t("Send", "Отправить")}
                  </button>
                </div>
              ) : (
                <p className="text-center text-xs text-gray-500 py-2">
                  {t("This ticket is closed.", "Этот тикет закрыт.")}
                </p>
              )}
            </div>
          ) : activeTab === "new" ? (
            /* Create New Ticket Form */
            <form onSubmit={handleCreateTicket} className="space-y-4">
              {!currentUser || currentUser.isAnonymous ? (
                <div className="rounded-2xl border border-[#3a2028] bg-[#170e12] p-4 text-center text-xs text-gray-300">
                  {t(
                    "Please sign in on the main page to create and track support tickets.",
                    "Пожалуйста, авторизуйтесь на сайте, чтобы отправить тикет и получать ответы."
                  )}
                </div>
              ) : null}

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-gray-400 mb-1.5">
                  {t("Category", "Категория вопроса")}
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { id: "loader", label: t("Launcher", "Лоадер") },
                    { id: "cheat", label: t("Cheat", "Чит") },
                    { id: "payment", label: t("Payment", "Оплата") },
                    { id: "other", label: t("Other", "Другое") },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id as any)}
                      className={`rounded-xl border py-2 text-xs font-bold transition ${
                        category === cat.id
                          ? "border-[#ffb7c5] bg-[#ffb7c5] text-black"
                          : "border-[#25181e] bg-[#120b0e] text-gray-400 hover:text-white"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-gray-400 mb-1.5">
                  {t("Contact for communication (Discord / Telegram / Email)", "Контакт для связи (Discord / Telegram)")}
                </label>
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="@telegram_handle or Discord username"
                  className="w-full rounded-xl border border-[#2b1921] bg-[#120b0e] px-4 py-2.5 text-xs text-white outline-none focus:border-[#ffb7c5] transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-gray-400 mb-1.5">
                  {t("Describe your issue", "Опишите проблему")}
                </label>
                <textarea
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t(
                    "Explain what happened, what error appeared, or what question you have...",
                    "Подробно опишите, что произошло, какая ошибка появилась или какой у вас вопрос..."
                  )}
                  className="w-full rounded-xl border border-[#2b1921] bg-[#120b0e] px-4 py-2.5 text-xs text-white outline-none focus:border-[#ffb7c5] transition"
                />
              </div>

              {submitError && (
                <p className="text-xs text-[#ff9aa9] font-medium">{submitError}</p>
              )}
              {submitSuccess && (
                <p className="text-xs text-[#8ce5b2] font-medium">{submitSuccess}</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !currentUser || currentUser.isAnonymous}
                className="w-full rounded-full border border-[#ffb7c5]/40 bg-[#ffb7c5] py-3 text-xs font-bold uppercase tracking-[0.16em] text-black shadow-[0_0_24px_rgba(255,183,197,0.25)] transition hover:bg-white disabled:opacity-50"
              >
                {isSubmitting ? t("Submitting...", "Отправляем...") : t("Submit Ticket", "Отправить обращение")}
              </button>
            </form>
          ) : (
            /* Tickets List View (My Tickets or Admin Inbox) */
            <div className="space-y-3">
              {isAdmin && activeTab === "admin" && (
                /* Admin Discord Webhook Settings Accordion */
                <div className="mb-4 rounded-2xl border border-[#26171d] bg-[#110a0e] p-3.5">
                  <p className="text-[10px] font-mono uppercase text-gray-400 tracking-[0.2em] mb-1.5">
                    {t("Discord Webhook Integration", "Discord Webhook (Уведомления в канал)")}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://discord.com/api/webhooks/..."
                      value={discordWebhookUrl}
                      onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                      className="flex-1 rounded-xl border border-[#28181f] bg-[#0c080a] px-3 py-1.5 text-xs text-gray-300 outline-none focus:border-[#ffb7c5]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        window.localStorage.setItem(DEFAULT_DISCORD_WEBHOOK_KEY, discordWebhookUrl.trim());
                        alert(t("Discord Webhook saved!", "Discord Webhook сохранён!"));
                      }}
                      className="rounded-xl border border-[#ffb7c5]/30 bg-[#ffb7c5] px-3.5 py-1.5 text-xs font-bold text-black hover:bg-white transition"
                    >
                      {t("Save", "Сохранить")}
                    </button>
                  </div>
                </div>
              )}

              {isLoadingTickets ? (
                <div className="py-8 text-center text-xs text-gray-500">
                  {t("Loading tickets...", "Загрузка обращений...")}
                </div>
              ) : tickets.length === 0 ? (
                <div className="rounded-2xl border border-[#211519] bg-[#100a0d] p-8 text-center text-xs text-gray-500">
                  {t("No tickets found.", "Нет активных обращений.")}
                </div>
              ) : (
                tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[#23171b] bg-[#110a0e] p-4 transition hover:border-[#ffb7c5]/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">
                          #{ticket.id.slice(-6)}
                        </span>
                        <span className="rounded bg-[#1a1115] px-2 py-0.5 text-[10px] font-mono text-[#ffb7c5]">
                          {ticket.category}
                        </span>
                        {isAdmin && (
                          <span className="text-[11px] text-gray-400">
                            @{ticket.authorLogin}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-gray-300">
                        {ticket.messages[ticket.messages.length - 1]?.text || "..."}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                        ticket.status === "open"
                          ? "bg-[#38bdf8]/10 text-[#7dd3fc]"
                          : ticket.status === "answered"
                          ? "bg-[#8ce5b2]/10 text-[#8ce5b2]"
                          : "bg-gray-800 text-gray-400"
                      }`}>
                        {ticket.status === "open" ? t("Open", "Открыт") : ticket.status === "answered" ? t("Answered", "Отвечен") : t("Closed", "Закрыт")}
                      </span>
                      <p className="mt-1 text-[10px] text-gray-500 font-mono">
                        {new Date(ticket.updatedAt).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
