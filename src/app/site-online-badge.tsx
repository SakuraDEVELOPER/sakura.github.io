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
      className={`inline-flex items-center gap-2 rounded-full border border-[#ffb7c5]/35 bg-[#1a1012] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ffe2ea] shadow-[0_0_24px_rgba(255,183,197,0.18)] ${className}`.trim()}
    >
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 rounded-full bg-[#ff8fb0] shadow-[0_0_14px_rgba(255,143,176,0.95)]"
      />
      <span>{label}</span>
    </div>
  );
}
