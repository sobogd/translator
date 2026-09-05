// Scroll lock, shared by every overlay that has one (the modal shell).
//
// The desktop chrome pins the page at 100dvh and scrolls content inside the
// window (.page-scroll), so locking scroll means hiding overflow on that
// container — and on <body> too, for the rare standalone surface (404).
// .window-scroll is the single-scroll window used on pages without the
// translator product part.
const SCROLLERS = ".window-scroll, .page-scroll";
//
// Ref-counted on purpose. Two overlays used to do the obvious thing — save
// the element's overflow, set "hidden", restore the saved value on close —
// which breaks the moment two overlays overlap: opening the account modal
// FROM another overlay makes the modal save "hidden" (the first one's own
// lock). Closing the first restores "", then closing the modal writes
// "hidden" back, and the page can never be scrolled again.
//
// Only the first lock records the original values, and only the last release
// puts them back.
let locks = 0;
let previousByEl = new Map<HTMLElement, string>();

/** Locks page/window scroll and returns the matching release (idempotent). */
export function lockScroll(): () => void {
  const targets =
    typeof document === "undefined"
      ? []
      : ([document.body, ...Array.from(document.querySelectorAll<HTMLElement>(SCROLLERS))] as HTMLElement[]);
  if (locks === 0) {
    previousByEl = new Map(targets.map((el) => [el, el.style.overflow]));
  }
  locks += 1;
  for (const el of targets) el.style.overflow = "hidden";
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks -= 1;
    if (locks === 0) {
      for (const [el, prev] of previousByEl) el.style.overflow = prev;
      previousByEl = new Map();
    }
  };
}
