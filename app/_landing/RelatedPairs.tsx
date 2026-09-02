import Link from "next/link";
import { CARD } from "./shell";

// In-body cross-links between pair pages. Until now the only path from one
// pair page to another was the header dropdown and the footer — navigation
// chrome, which carries far less weight than a contextual link inside the
// content, and which a visitor reading to the end of the page never sees.
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
    <div className={`${CARD} flex flex-col gap-3 p-5 sm:p-6`}>
      <h2 className="text-base font-medium tracking-tight sm:text-lg">{heading}</h2>
      <nav className="flex flex-wrap gap-x-4 gap-y-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-sm text-hint transition-colors hover:text-text"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
