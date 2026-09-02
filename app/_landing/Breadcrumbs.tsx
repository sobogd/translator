import Link from "next/link";

// Visible counterpart to breadcrumbLd (lib/structured-data.ts). The
// BreadcrumbList JSON-LD used to ship on its own, describing a trail the
// visitor could not see anywhere on the page; the label here is the same
// string the markup carries, so the two cannot drift.
//
// Rendered under the four stat cards on the feature/pair pages, which is
// where the page stops being hero and starts being content.
export function Breadcrumbs({
  homeHref,
  homeLabel,
  current,
}: {
  homeHref: string;
  homeLabel: string;
  current: string;
}) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-hint">
        <li>
          <Link href={homeHref} className="transition-colors hover:text-text">
            {homeLabel}
          </Link>
        </li>
        {/* Separator is decorative — the list structure already carries the
            hierarchy for assistive tech. */}
        <li aria-hidden="true" className="text-hint/50">
          /
        </li>
        <li aria-current="page" className="font-medium text-text">
          {current}
        </li>
      </ol>
    </nav>
  );
}
