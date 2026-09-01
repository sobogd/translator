export const localeHome = (locale: string): string => (locale === "en" ? "/" : `/${locale}`);

export const localePath = (locale: string, slug: string): string => {
  const normalized = slug.startsWith("/") ? slug : `/${slug}`;
  return locale === "en" ? normalized : `/${locale}${normalized}`;
};
