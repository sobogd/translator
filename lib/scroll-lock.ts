// Page-scroll lock, shared by every overlay that has one (the modal shell and
// the header's burger panel).
//
// Ref-counted on purpose. Both used to do the obvious thing — save
// document.body.style.overflow, set "hidden", restore the saved value on close
// — which breaks the moment two overlays overlap: opening the account modal
// FROM the burger panel makes the modal save "hidden" (the panel's own lock).
// Closing the panel first restores "", then closing the modal writes "hidden"
// back, and the page can never be scrolled again.
//
// Only the first lock records the original value, and only the last release
// puts it back.
let locks = 0;
let previous = "";

/** Locks page scroll and returns the matching release (idempotent). */
export function lockScroll(): () => void {
  if (locks === 0) previous = document.body.style.overflow;
  locks += 1;
  document.body.style.overflow = "hidden";
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks -= 1;
    if (locks === 0) document.body.style.overflow = previous;
  };
}
