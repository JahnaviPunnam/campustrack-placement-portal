import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/guards";
import { PortalShell } from "@/components/layout/portal-shell";

export default async function RecruiterLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "RECRUITER") redirect("/forbidden");
  if (user.mustChangePassword) redirect("/account/password");
  if (!user.recruiterProfile || !user.recruiterProfile.company.isActive) redirect("/forbidden");

  return (
    <PortalShell role="RECRUITER" name={user.name} email={user.email}>
      {children}
    </PortalShell>
  );
}
