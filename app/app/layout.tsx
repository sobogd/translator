import { redirect } from "next/navigation";
import { getServerSessionEmail } from "@/lib/auth";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const email = await getServerSessionEmail();
  if (!email) redirect("/");

  return children;
}
