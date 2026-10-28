import Link from "next/link";
import { GraduationCap, LogOut } from "lucide-react";
import type { Role } from "@/lib/constants";
import { roleLabel } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { PortalSidebar } from "@/components/layout/portal-sidebar";
import { NotificationBell } from "@/components/layout/notification-bell";
import { RealtimeBridge } from "@/components/layout/realtime-bridge";
import { logoutAction } from "@/server/actions/auth";

type PortalShellProps = {
  role: Role;
  name: string;
  email: string;
  children: React.ReactNode;
};

export function PortalShell({ role, name, email, children }: PortalShellProps) {
  return (
    <div className="min-h-screen bg-background lg:flex">
      <RealtimeBridge />
      <aside className="hidden w-64 shrink-0 border-r bg-card/60 lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-4 w-4" />
            </span>
            CampusTrack
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <PortalSidebar role={role} />
        </div>
        <div className="border-t p-3">
          <div className="rounded-lg bg-muted/60 p-3">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-primary">
              {roleLabel(role)}
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur lg:px-8">
          <Link href="/" className="flex items-center gap-2 font-semibold lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-4 w-4" />
            </span>
            <span className="hidden sm:inline">CampusTrack</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell role={role} />
            <ThemeToggle />
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="icon" aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </header>
        <div className="border-b bg-card/40 px-3 py-2 lg:hidden">
          <PortalSidebar role={role} mobile />
        </div>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
