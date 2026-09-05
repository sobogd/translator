import Link from "next/link";

// In-body cross-links between pair pages, styled as the plain list of related
// guides in iq-mermaid's article pages (no card, no divider).
//
// Labels come from the locale's own footer.featureLinks, so the anchor text
// is already translated and always matches the slug it points at.
export function RelatedPairs({
  heading,
  links,
}: {
  heading: string;
  links: { href: string; label: string }[];
}) {
  if (links.length === 0) return null;
  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-2xl font-semibold leading-[1.15] tracking-tight text-text sm:text-3xl">
        {heading}
      </h2>
      <ol className="flex flex-col gap-4">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-[15px] font-semibold leading-snug tracking-tight text-text underline-offset-4 transition-colors hover:underline hover:decoration-text/40"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
