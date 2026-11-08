"use client";

import { useState } from "react";
import { useLocaleText } from "@/lib/ui-locale";
import SupportTicketsModal from "./support-tickets-modal";

export default function FloatingSupportButton() {
  const { t } = useLocaleText();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="fixed left-4 bottom-4 z-[120]">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-[#3a2028] bg-[#120b0e]/95 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#ffb7c5] shadow-[0_0_24px_rgba(255,183,197,0.15)] backdrop-blur transition hover:border-[#ffb7c5]/50 hover:bg-[#1a0f14] hover:text-white"
        >
          <span className="flex h-2 w-2 rounded-full bg-[#8ce5b2] shadow-[0_0_8px_rgba(140,229,178,0.8)]" />
          <span>{t("Support", "Поддержка")}</span>
        </button>
      </div>

      <SupportTicketsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
