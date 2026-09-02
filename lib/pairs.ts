import type { Locale } from "./locales";

// Language-pair SEO pages: one page per (locale, target language), slugged in
// the locale's own language (latinized). This registry — not the content
// files — is the single source of truth for which pair pages exist, their
// URLs and their translator preset; sitemap, static params and the content
// validator all read from here. Pair selection comes from the Google Ads
// Keyword Planner demand matrix (see workspace translator-pairs-research.md):
// each locale gets only the target languages people actually search for.
//
// Pair pages are locale-unique (a ru→en page is not a translation of the
// en→ru page — direction and keyword differ), so they deliberately do NOT
// register in LOCALE_SLUG_OVERRIDES and emit no hreflang alternates.
export type PairDef = {
  locale: Locale;
  /** ISO code of the source language (the locale's language) for the translator preset. */
  from: string;
  /** ISO code of the target language for the translator preset. */
  to: string;
  /** URL slug within the locale (no locale prefix, no leading slash). */
  slug: string;
};

const P = (locale: Locale, from: string, pairs: [to: string, slug: string][]): PairDef[] =>
  pairs.map(([to, slug]) => ({ locale, from, to, slug }));

export const PAIRS: PairDef[] = [
  ...P("en", "en", [
    ["es", "translate-english-to-spanish"],
    ["ar", "translate-english-to-arabic"],
    ["zh", "translate-english-to-chinese"],
    ["ko", "translate-english-to-korean"],
    ["ja", "translate-english-to-japanese"],
    ["pl", "translate-english-to-polish"],
    ["ru", "translate-english-to-russian"],
    ["de", "translate-english-to-german"],
    ["fr", "translate-english-to-french"],
    ["it", "translate-english-to-italian"],
    ["pt", "translate-english-to-portuguese"],
    ["tr", "translate-english-to-turkish"],
  ]),
  ...P("es", "es", [
    ["en", "traductor-espanol-ingles"],
    ["ca", "traductor-espanol-catalan"],
    ["fr", "traductor-espanol-frances"],
    ["it", "traductor-espanol-italiano"],
    ["zh", "traductor-espanol-chino"],
    ["pt", "traductor-espanol-portugues"],
    ["ar", "traductor-espanol-arabe"],
    ["ru", "traductor-espanol-ruso"],
  ]),
  ...P("de", "de", [
    ["en", "uebersetzer-deutsch-englisch"],
    ["es", "uebersetzer-deutsch-spanisch"],
    ["ru", "uebersetzer-deutsch-russisch"],
    ["it", "uebersetzer-deutsch-italienisch"],
    ["ar", "uebersetzer-deutsch-arabisch"],
    ["tr", "uebersetzer-deutsch-tuerkisch"],
    ["pl", "uebersetzer-deutsch-polnisch"],
    ["uk", "uebersetzer-deutsch-ukrainisch"],
    ["ro", "uebersetzer-deutsch-rumaenisch"],
    ["hr", "uebersetzer-deutsch-kroatisch"],
  ]),
  ...P("fr", "fr", [
    ["en", "traducteur-francais-anglais"],
    ["es", "traducteur-francais-espagnol"],
    ["ar", "traducteur-francais-arabe"],
    ["de", "traducteur-francais-allemand"],
    ["it", "traducteur-francais-italien"],
    ["nl", "traducteur-francais-neerlandais"],
    ["pt", "traducteur-francais-portugais"],
    ["tr", "traducteur-francais-turc"],
  ]),
  ...P("it", "it", [
    ["en", "traduttore-italiano-inglese"],
    ["fr", "traduttore-italiano-francese"],
    ["de", "traduttore-italiano-tedesco"],
    ["ar", "traduttore-italiano-arabo"],
    ["ru", "traduttore-italiano-russo"],
    ["zh", "traduttore-italiano-cinese"],
    ["ja", "traduttore-italiano-giapponese"],
  ]),
  ...P("pt", "pt", [
    ["en", "tradutor-portugues-ingles"],
    ["es", "tradutor-portugues-espanhol"],
    ["fr", "tradutor-portugues-frances"],
    ["ja", "tradutor-portugues-japones"],
    ["it", "tradutor-portugues-italiano"],
    ["ar", "tradutor-portugues-arabe"],
  ]),
  ...P("nl", "nl", [
    ["en", "vertaler-nederlands-engels"],
    ["fr", "vertaler-nederlands-frans"],
    ["de", "vertaler-nederlands-duits"],
    ["es", "vertaler-nederlands-spaans"],
    ["it", "vertaler-nederlands-italiaans"],
    ["tr", "vertaler-nederlands-turks"],
  ]),
  ...P("pl", "pl", [
    ["en", "tlumacz-polsko-angielski"],
    ["de", "tlumacz-polsko-niemiecki"],
    ["zh", "tlumacz-polsko-chinski"],
    ["es", "tlumacz-polsko-hiszpanski"],
    ["ru", "tlumacz-polsko-rosyjski"],
    ["uk", "tlumacz-polsko-ukrainski"],
    ["fr", "tlumacz-polsko-francuski"],
    ["cs", "tlumacz-polsko-czeski"],
  ]),
  ...P("ru", "ru", [
    ["en", "perevodchik-s-russkogo-na-angliyskiy"],
    ["de", "perevodchik-s-russkogo-na-nemetskiy"],
    ["uk", "perevodchik-s-russkogo-na-ukrainskiy"],
    ["pl", "perevodchik-s-russkogo-na-polskiy"],
    ["es", "perevodchik-s-russkogo-na-ispanskiy"],
    ["tr", "perevodchik-s-russkogo-na-turetskiy"],
    ["ar", "perevodchik-s-russkogo-na-arabskiy"],
  ]),
  ...P("uk", "uk", [
    ["en", "perekladach-z-ukrainskoi-na-anhliysku"],
    ["pl", "perekladach-z-ukrainskoi-na-polsku"],
    ["de", "perekladach-z-ukrainskoi-na-nimetsku"],
    ["ru", "perekladach-z-ukrainskoi-na-rosiysku"],
    ["it", "perekladach-z-ukrainskoi-na-italiysku"],
    ["cs", "perekladach-z-ukrainskoi-na-chesku"],
    ["es", "perekladach-z-ukrainskoi-na-ispansku"],
  ]),
  ...P("sv", "sv", [
    ["en", "oversattare-svenska-engelska"],
    ["de", "oversattare-svenska-tyska"],
    ["es", "oversattare-svenska-spanska"],
    ["fr", "oversattare-svenska-franska"],
    ["da", "oversattare-svenska-danska"],
    ["no", "oversattare-svenska-norska"],
    ["fi", "oversattare-svenska-finska"],
  ]),
  ...P("da", "da", [
    ["en", "oversaetter-dansk-engelsk"],
    ["de", "oversaetter-dansk-tysk"],
    ["es", "oversaetter-dansk-spansk"],
    ["sv", "oversaetter-dansk-svensk"],
    ["fr", "oversaetter-dansk-fransk"],
  ]),
  ...P("no", "no", [
    ["en", "oversetter-norsk-engelsk"],
    ["es", "oversetter-norsk-spansk"],
    ["de", "oversetter-norsk-tysk"],
    ["sv", "oversetter-norsk-svensk"],
  ]),
  ...P("fi", "fi", [
    ["en", "kaantaja-suomi-englanti"],
    ["es", "kaantaja-suomi-espanja"],
    ["de", "kaantaja-suomi-saksa"],
  ]),
  ...P("cs", "cs", [
    ["en", "prekladac-cesko-anglicky"],
    ["de", "prekladac-cesko-nemecky"],
    ["sk", "prekladac-cesko-slovensky"],
    ["it", "prekladac-cesko-italsky"],
    ["fr", "prekladac-cesko-francouzsky"],
    ["pl", "prekladac-cesko-polsky"],
    ["uk", "prekladac-cesko-ukrajinsky"],
  ]),
  ...P("el", "el", [
    ["en", "metafrastis-ellinika-agglika"],
    ["fr", "metafrastis-ellinika-gallika"],
    ["it", "metafrastis-ellinika-italika"],
    ["de", "metafrastis-ellinika-germanika"],
    ["es", "metafrastis-ellinika-ispanika"],
  ]),
  ...P("tr", "tr", [
    ["en", "ceviri-turkce-ingilizce"],
    ["ar", "ceviri-turkce-arapca"],
    ["de", "ceviri-turkce-almanca"],
    ["ru", "ceviri-turkce-rusca"],
    ["fr", "ceviri-turkce-fransizca"],
    ["es", "ceviri-turkce-ispanyolca"],
    ["fa", "ceviri-turkce-farsca"],
  ]),
  ...P("ro", "ro", [
    ["en", "traducere-romana-engleza"],
    ["de", "traducere-romana-germana"],
    ["fr", "traducere-romana-franceza"],
    ["it", "traducere-romana-italiana"],
    ["tr", "traducere-romana-turca"],
    ["es", "traducere-romana-spaniola"],
  ]),
  ...P("hu", "hu", [
    ["en", "fordito-magyar-angol"],
    ["de", "fordito-magyar-nemet"],
  ]),
  ...P("bg", "bg", [
    ["en", "prevodach-bulgarski-angliyski"],
    ["ru", "prevodach-bulgarski-ruski"],
    ["tr", "prevodach-bulgarski-turski"],
    ["de", "prevodach-bulgarski-nemski"],
  ]),
  ...P("hr", "hr", [
    ["en", "prevoditelj-hrvatski-engleski"],
    ["de", "prevoditelj-hrvatski-njemacki"],
    ["it", "prevoditelj-hrvatski-talijanski"],
  ]),
  ...P("sk", "sk", [
    ["en", "prekladac-slovensko-anglicky"],
    ["cs", "prekladac-slovensko-cesky"],
    ["de", "prekladac-slovensko-nemecky"],
  ]),
  ...P("sl", "sl", [
    ["en", "prevajalnik-slovensko-anglesko"],
    ["de", "prevajalnik-slovensko-nemsko"],
    ["it", "prevajalnik-slovensko-italijansko"],
  ]),
  ...P("et", "et", [
    ["en", "tolkija-eesti-inglise"],
    ["fi", "tolkija-eesti-soome"],
    ["de", "tolkija-eesti-saksa"],
  ]),
  ...P("lv", "lv", [
    ["en", "tulkotajs-latviesu-anglu"],
    ["ru", "tulkotajs-latviesu-krievu"],
  ]),
  ...P("lt", "lt", [
    ["en", "vertejas-lietuviu-anglu"],
    ["de", "vertejas-lietuviu-vokieciu"],
    ["pl", "vertejas-lietuviu-lenku"],
  ]),
  ...P("sr", "sr", [
    ["en", "prevodilac-srpski-engleski"],
    ["de", "prevodilac-srpski-nemacki"],
    ["es", "prevodilac-srpski-spanski"],
    ["it", "prevodilac-srpski-italijanski"],
    ["tr", "prevodilac-srpski-turski"],
    ["ru", "prevodilac-srpski-ruski"],
  ]),
  ...P("ca", "ca", [
    ["en", "traductor-catala-angles"],
    ["es", "traductor-catala-castella"],
    ["fr", "traductor-catala-frances"],
  ]),
  ...P("is", "is", [["en", "thydandi-islensku-enska"]]),
  ...P("fa", "fa", [
    ["ar", "motarjem-farsi-arabi"],
    ["tr", "motarjem-farsi-torki"],
    ["en", "motarjem-farsi-englisi"],
    ["de", "motarjem-farsi-almani"],
  ]),
  ...P("ar", "ar", [
    ["en", "motarjem-arabi-injlizi"],
    ["tr", "motarjem-arabi-turki"],
    ["fr", "motarjem-arabi-faransi"],
    ["es", "motarjem-arabi-isbani"],
    ["de", "motarjem-arabi-almani"],
    ["ru", "motarjem-arabi-rusi"],
  ]),
  ...P("ja", "ja", [
    ["en", "honyaku-nihongo-eigo"],
    ["ko", "honyaku-nihongo-kankokugo"],
    ["zh", "honyaku-nihongo-chugokugo"],
    ["fr", "honyaku-nihongo-furansugo"],
  ]),
  ...P("ko", "ko", [
    ["en", "beonyeok-hangugeo-yeongeo"],
    ["ja", "beonyeok-hangugeo-ilboneo"],
    ["zh", "beonyeok-hangugeo-junggugeo"],
    ["de", "beonyeok-hangugeo-dogileo"],
  ]),
  ...P("zh", "zh", [
    ["en", "fanyi-zhongwen-yingwen"],
    ["ja", "fanyi-zhongwen-riwen"],
    ["ru", "fanyi-zhongwen-ewen"],
  ]),
];

export const pairsForLocale = (locale: string): PairDef[] =>
  PAIRS.filter((p) => p.locale === locale);

export const findPair = (locale: string, slug: string): PairDef | undefined =>
  PAIRS.find((p) => p.locale === locale && p.slug === slug);
