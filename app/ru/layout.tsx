import { DesktopChrome } from "@/app/_landing/desktop/DesktopChrome";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";

// Viewport (theme colour, no zoom lock) is inherited from the root layout
// (app/layout.tsx imports ./globals.css). This group only owns its shell.
export default function RuLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <DesktopChrome />
        {children}
      </body>
    </html>
  );
}
