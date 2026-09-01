export const NARROW = "max-w-[1000px] mx-auto px-4 sm:px-6";
export const PAGE = "relative flex flex-col gap-6";
export const CARD = "rounded-2xl border border-border";

export const BTN_BOX =
  "h-10 px-4 text-sm font-semibold rounded-lg whitespace-nowrap inline-flex items-center justify-center transition-all active:scale-[0.99]";
export const PRIMARY_BTN = `${BTN_BOX} bg-gradient-to-br from-emerald-500 to-teal-400 text-white hover:opacity-90`;
export const OUTLINE_BTN = `${BTN_BOX} border border-border text-text bg-transparent hover:bg-card`;

export function Container({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`w-full`}>
      <div className={`${NARROW} flex flex-col gap-6 ${className}`}>{children}</div>
    </div>
  );
}

export function Band({
  id,
  className = "",
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={className}>
      {children}
    </section>
  );
}
