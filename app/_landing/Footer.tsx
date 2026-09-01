import { NARROW } from "./shell";

export function Footer() {
  return (
    <footer className="border-t border-border py-8">
      <div className={`${NARROW} flex flex-col items-center justify-between gap-3 text-sm text-hint sm:flex-row`}>
        <span>© {new Date().getFullYear()} IQ Translate</span>
        <span>Real-time voice translation, 186 languages</span>
      </div>
    </footer>
  );
}
