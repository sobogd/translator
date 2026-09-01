import { redirect } from "next/navigation";
import { getServerSessionEmail } from "@/lib/auth";
import { Landing } from "./_landing/Landing";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const email = await getServerSessionEmail();
  if (email) redirect("/app");

  return <Landing />;
}
