import { getServerSessionEmail } from "@/lib/auth";
import { Landing } from "./_landing/Landing";

export default async function RootPage() {
  const email = await getServerSessionEmail();
  return <Landing signedIn={!!email} />;
}
