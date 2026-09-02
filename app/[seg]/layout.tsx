import { locales, rtlLocales } from "@/lib/locales";

// Document shell for every dynamic-segment route (locale homes, pair pages,
// localized pricing). The (en)/ and ru/ groups own their static shells; this
// mirrors them and sets the correct lang + dir per locale — without it these
// routes rendered with no <html> element at all (no lang, broken sticky
// header styling context).
export default async function SegLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ seg: string }>;
}) {
  const { seg } = await params;
  const lang = (locales as readonly string[]).includes(seg) ? seg : "en";
  const dir = (rtlLocales as readonly string[]).includes(lang) ? "rtl" : undefined;
  return (
    <html lang={lang} dir={dir} className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
