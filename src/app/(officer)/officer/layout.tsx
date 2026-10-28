import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/guards";
import { PortalShell } from "@/components/layout/portal-shell";

export default async function OfficerLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "PLACEMENT_OFFICER") redirect("/forbidden");
  if (user.mustChangePassword) redirect("/account/password");

  return (
    <PortalShell role="PLACEMENT_OFFICER" name={user.name} email={user.email}>
      {children}
    </PortalShell>
  );
}
