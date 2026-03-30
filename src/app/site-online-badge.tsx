type SiteOnlineBadgeProps = {
  count: number | null;
  className?: string;
};

export function SiteOnlineBadge({ count, className = "" }: SiteOnlineBadgeProps) {
  const label =
    count === null
      ? "Online on site"
      : `${count} ${count === 1 ? "user" : "users"} online`;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-[#8b5cf6]/35 bg-[#130d1f] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#eadcff] shadow-[0_0_24px_rgba(139,92,246,0.18)] ${className}`.trim()}
    >
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 rounded-full bg-[#a855f7] shadow-[0_0_14px_rgba(168,85,247,0.9)]"
      />
      <span>{label}</span>
    </div>
  );
}
