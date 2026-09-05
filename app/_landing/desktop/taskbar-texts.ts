// Taskbar copy & account-copy shapes, in a server-safe module (no "use
// client"), so server pages can build the merged header texts and pass them to
// the client Taskbar as props. English defaults keep the bar working until a
// locale's chrome carries the translated keys.
export type TaskbarTexts = {
  logo: string;
  /** Trigger for the language-pairs menu (ex-footer feature links). */
  features: string;
  pricing: string;
  /** The right-edge CTA: scrolls the content window back to the widget. */
  translate: string;
  menu: string;
  languages: string;
  legal: string;
  theme: string;
  themeSystem: string;
  themeLight: string;
  themeDark: string;
  legalPrivacy: string;
  legalTerms: string;
  account: string;
  signIn: string;
  logOut: string;
  anyLanguageHint: string;
};

export type AccountTexts = {
  title: string;
  planLabel: string;
  freePlan: string;
  minutesLeft: string;
  charsLeft: string;
  manageSubscription: string;
  upgrade: string;
};

export const DEFAULT_TEXTS: TaskbarTexts = {
  logo: "Translate",
  features: "Features",
  pricing: "Pricing",
  translate: "Translate",
  menu: "Menu",
  languages: "Languages",
  legal: "Legal",
  theme: "Theme",
  themeSystem: "System",
  themeLight: "Light",
  themeDark: "Dark",
  legalPrivacy: "Privacy",
  legalTerms: "Terms",
  account: "Account",
  signIn: "Sign in",
  logOut: "Log out",
  anyLanguageHint: "Translate to any language",
};

export const DEFAULT_ACCOUNT_TEXTS: AccountTexts = {
  title: "Account",
  planLabel: "Plan",
  freePlan: "Free trial",
  minutesLeft: "Voice minutes left",
  charsLeft: "Characters left",
  manageSubscription: "Manage subscription",
  upgrade: "Upgrade",
};

/** Merges a locale's header copy over the English fallbacks, so the taskbar
 *  keeps working (English menu labels) until every locale carries the new
 *  header keys (menu / languages / legal / theme / translate…). */
export const mergeTaskbarTexts = (header: Partial<TaskbarTexts> | undefined): TaskbarTexts => ({
  ...DEFAULT_TEXTS,
  ...header,
});
