import "../globals.css";

// Viewport (theme colour, no zoom lock) is inherited from the root layout.
export default function EnLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
