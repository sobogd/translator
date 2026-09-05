"use client";

// Persistent desktop chrome: the wallpaper behind the floating window.
// Rendered once by the locale layout (NOT by each page), so it survives client
// navigation between pages of the same locale. The per-page `DesktopShell`
// stacks the taskbar and the content window on top.
//
// Unlike iq-mermaid there is no editor layer under the window — the product
// (the translator widget) lives inside the window itself — so this chrome is
// just the folded-paper desktop.
export function DesktopChrome() {
  return <div className="desktop-wallpaper" aria-hidden="true" />;
}
