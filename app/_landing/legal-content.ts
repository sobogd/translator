import type { LegalSection } from "./LegalPage";

// The operator details every legal text below refers to. One place to edit
// when the contact address or the entity behind the service changes.
export const OPERATOR = {
  service: "IQ Translate",
  site: "iq-translate.com",
  email: "support@iq-translate.com",
  country: "Spain",
};

export const LEGAL_UPDATED = "2026-09-02";

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: "What we collect",
    body: [
      "Without an account: nothing you have to give us. To keep the free trial from being reset endlessly, we derive a technical fingerprint from your request (IP address, browser user agent and language header), store it as a hash, and count characters and voice seconds against it.",
      `With an account: the email address of the Google account you sign in with, and a session record (a hash of your session token, never the token itself). We do not receive your Google password and we do not ask Google for anything beyond your email address and its verified status.`,
      "Content: the text or speech you submit for translation, the resulting transcript and translation, and the language pair, stored as conversation topics so your history is there when you come back.",
      "Payments: if you subscribe, Stripe processes the payment and we store only your Stripe customer and subscription identifiers, the plan, its status and the renewal date. Card numbers never reach our servers.",
    ],
  },
  {
    heading: "Voice recordings",
    body: [
      "Audio you record is sent to our server, forwarded to Google's Gemini API for speech recognition, and discarded as soon as the transcript comes back. We do not store audio files.",
      "The resulting transcript is stored with the translation, in the conversation topic it belongs to, so you can read the thread later.",
    ],
  },
  {
    heading: "Who else processes your data",
    body: [
      "Google (Gemini API) — speech recognition and translation of the text you submit. Google (Sign-In) — authentication when you choose to sign in.",
      "Stripe — payment processing and subscription management for paid plans.",
      "Cloudflare (Turnstile) — an anti-abuse check shown to visitors without an account, protecting the free tier from automated use.",
      "We do not sell your data, we do not run advertising trackers, and we do not share your translations with anyone beyond the processors listed above.",
    ],
  },
  {
    heading: "Cookies and local storage",
    body: [
      "We use no advertising or analytics cookies. The cookies we do set are strictly functional: a session cookie when you are signed in, a companion flag that only says whether you are signed in, a language preference, and a short-lived pass issued after an anti-abuse check.",
      "Your browser also stores your last chosen target language and the last conversation you had open, so the widget reopens where you left it. That stays in your browser and is never sent to us as such.",
    ],
  },
  {
    heading: "How long we keep it",
    body: [
      "Conversations and their translations are kept until you delete them — you can clear an individual thread or your whole history from the widget at any time — or until you ask us to delete your account.",
      "Free-tier usage counters tied to a request fingerprint are kept for as long as the trial pool applies. Billing records are kept for as long as tax and accounting law requires.",
    ],
  },
  {
    heading: "Your rights",
    body: [
      `If you are in the EEA or the UK you can ask for a copy of your data, its correction, its deletion, a restriction of processing, or portability, and you can object to processing. Write to ${OPERATOR.email} and we will answer within one month.`,
      "You can also complain to your national data protection authority.",
    ],
  },
  {
    heading: "Security and transfers",
    body: [
      "Traffic is served over HTTPS, session tokens are stored only as hashes, and access to the database is limited to the service itself.",
      "Speech recognition and translation are performed by Google, which may process the submitted content outside your country under its own safeguards. Do not submit content you are not allowed to share with a third-party processor.",
    ],
  },
  {
    heading: "Children",
    body: [
      "The service is not directed at children under 16. If you believe a child has given us personal data, contact us and we will delete it.",
    ],
  },
  {
    heading: "Changes and contact",
    body: [
      "If this policy changes materially we will update the date at the top of this page and, for account holders, note it in the app.",
      `Questions or requests: ${OPERATOR.email}.`,
    ],
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: "The service",
    body: [
      `${OPERATOR.service} translates text and speech between languages in your browser. Translation is produced by an automated model; it is not a certified or human translation and can be wrong, incomplete or badly nuanced.`,
      "Do not rely on it alone for medical, legal, financial or safety-critical decisions, or for any document that must be certified.",
    ],
  },
  {
    heading: "Free tier and accounts",
    body: [
      "You can use the service without an account, within a limited lifetime free allowance of characters and voice seconds. Anti-abuse checks may be shown before a translation runs.",
      "Signing in with Google gives you history synced to your account and access to paid plans. You are responsible for what happens under your account and for keeping access to your Google account secure.",
    ],
  },
  {
    heading: "Plans and payment",
    body: [
      "Paid plans are billed monthly in advance through Stripe, at the prices shown on the pricing page, and renew automatically until cancelled. Each plan includes a monthly allowance of translated characters and voice minutes, which resets at the start of each billing period and does not roll over.",
      "You can cancel at any time from the account modal; the plan then stays active until the end of the period already paid for. We may change prices with notice, effective from your next renewal.",
      "If you are a consumer in the EU or the UK, you have a 14-day right of withdrawal for digital services. By starting to use paid quota you ask us to begin performance immediately and accept that the right lapses once the service has been fully performed.",
    ],
  },
  {
    heading: "Acceptable use",
    body: [
      "Do not use the service to break the law, to submit content you have no right to share, to attempt to circumvent quotas or anti-abuse measures, to resell the output as a certified translation, or to run automated bulk traffic against it.",
      "We may suspend or terminate access that abuses the service or endangers its availability for others.",
    ],
  },
  {
    heading: "Your content",
    body: [
      "What you submit stays yours. You grant us only the permission needed to run the service: to transmit your content to the processors listed in the privacy policy, to produce the translation, and to store the result in your history until you delete it.",
      "We do not use your content to train models.",
    ],
  },
  {
    heading: "Availability and liability",
    body: [
      "The service is provided as is, without warranty that it will be uninterrupted or error-free. We may change or discontinue features.",
      "To the extent permitted by law, our liability for any claim relating to the service is limited to the amount you paid us in the twelve months before the claim. Nothing here limits liability that cannot be limited by law, including your statutory consumer rights.",
    ],
  },
  {
    heading: "Changes, law and contact",
    body: [
      `We may update these terms; the date at the top of this page shows the current version, and continued use after a material change means you accept it. These terms are governed by the laws of ${OPERATOR.country}, without prejudice to the mandatory consumer protections of your country of residence.`,
      `Questions: ${OPERATOR.email}.`,
    ],
  },
];
