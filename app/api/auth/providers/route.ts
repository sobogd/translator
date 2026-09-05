import { NextResponse } from "next/server";
import { appleConfigured } from "@/lib/apple";

export const runtime = "nodejs";

// Which sign-in providers the server is actually configured for. The header
// sign-in panel fetches this and hides providers without credentials.
export async function GET() {
  const smtpConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );
  return NextResponse.json({
    google: true,
    apple: appleConfigured(),
    email: smtpConfigured,
  });
}
