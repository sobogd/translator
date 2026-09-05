// Manual theme control. The site's palette (app/globals.css) is light by
// default and switches to the dark tokens when <html data-theme="dark"> is
// present — deliberately NOT a prefers-color-scheme media query, so a visitor
// can override the OS (header → Theme → System / Light / Dark).
//
// "System" follows the OS; the resolved preference is persisted in
// localStorage under THEME_CHOICE_KEY ("system" | "light" | "dark").
export type ThemeChoice = "system" | "light" | "dark";

export const THEME_CHOICE_KEY = "iqt-theme";
/** Dispatched on <window> after the resolved theme attribute changes. */
export const THEME_CHANGE_EVENT = "iqt:theme-change";

/** Pre-paint inline script shared by every document shell ((en), [seg], and
 *  the root 404 page): applies the stored choice — or the OS preference under
 *  "system" — to <html> before first paint, so dark-mode visitors never see a
 *  light flash. Reads THEME_CHOICE_KEY here rather than hardcoding the key
 *  next to the duplicate script in each layout. */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k=${JSON.stringify(
  THEME_CHOICE_KEY,
)},v=window.localStorage.getItem(k),d=v? v==="dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.setAttribute("data-theme","dark");}catch(e){}})();`;

export function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** The stored choice — defaults to "system" when nothing was saved yet. */
export function getThemeChoice(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  try {
    const v = window.localStorage.getItem(THEME_CHOICE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    // Storage unreachable — fall through to the system preference.
  }
  return "system";
}

/** Whether the resolved theme (choice × OS) is dark right now. */
export function isDarkTheme(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.hasAttribute("data-theme");
}

/** Materialises the resolved theme on <html> and broadcasts the change. */
export function setThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === "system") window.localStorage.removeItem(THEME_CHOICE_KEY);
    else window.localStorage.setItem(THEME_CHOICE_KEY, choice);
  } catch {
    // Non-fatal: the choice still applies for this page view.
  }
  applyResolvedTheme(choice);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

/** Applies `choice` (falling back to the stored/system one) to <html>. */
export function applyResolvedTheme(choice: ThemeChoice = getThemeChoice()): void {
  const dark = choice === "dark" || (choice === "system" && systemPrefersDark());
  const el = document.documentElement;
  if (dark) el.setAttribute("data-theme", "dark");
  else el.removeAttribute("data-theme");
}

/**
 * Keeps the resolved theme in sync with the OS while the choice is "system"
 * and with theme changes made anywhere else (returns an unsubscribe fn).
 */
export function subscribeTheme(onChange?: (choice: ThemeChoice) => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onMq = () => {
    if (getThemeChoice() === "system") {
      applyResolvedTheme("system");
      onChange?.("system");
    }
  };
  const onEvent = () => {
    applyResolvedTheme();
    onChange?.(getThemeChoice());
  };
  mq.addEventListener("change", onMq);
  window.addEventListener(THEME_CHANGE_EVENT, onEvent);
  return () => {
    mq.removeEventListener("change", onMq);
    window.removeEventListener(THEME_CHANGE_EVENT, onEvent);
  };
}
