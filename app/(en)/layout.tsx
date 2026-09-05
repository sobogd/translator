import { DesktopChrome } from "@/app/_landing/desktop/DesktopChrome";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";

// Viewport (theme colour, no zoom lock) and the global stylesheet are inherited
// from the root layout (app/layout.tsx imports ./globals.css). This group only
// owns its document shell.
export default function EnLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {/* Set the resolved theme before first paint (see lib/theme.ts): dark
            gets `data-theme="dark"` on <html> from the stored choice or the
            OS preference, so there is no light flash for dark-mode visitors. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        {/* Persistent desktop chrome (wallpaper) — lives at the layout level
            so it is not remounted when navigating between pages of the same
            locale. The per-page DesktopShell stacks the taskbar and the
            content window on top. */}
        <DesktopChrome />
        {children}
      </body>
    </html>
  );
}
