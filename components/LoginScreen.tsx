export function LoginScreen() {
  return (
    <main
      className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <h1 className="text-2xl font-bold tracking-tight">Переводчик</h1>
      <p className="max-w-xs text-sm" style={{ color: "var(--hint)" }}>
        Войдите, чтобы продолжить.
      </p>
      <a
        href="/api/auth/google/start"
        className="rounded-full px-6 py-3 text-sm font-medium transition active:scale-95"
        style={{ background: "var(--button)", color: "var(--button-text)" }}
      >
        Войти через Google
      </a>
    </main>
  );
}
