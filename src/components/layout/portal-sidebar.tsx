"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  Bookmark,
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  FileBarChart,
  FileUp,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/constants";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const NAV: Record<Role, NavItem[]> = {
  STUDENT: [
    { href: "/student", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/student/profile", label: "Profile", icon: User },
    { href: "/student/skills", label: "Skills", icon: Sparkles, exact: true },
    { href: "/student/skills/gap", label: "Skill gap", icon: BarChart3 },
    { href: "/student/drives", label: "Drives", icon: BriefcaseBusiness },
    { href: "/student/applications", label: "Applications", icon: ListChecks },
    { href: "/student/notifications", label: "Notifications", icon: Bell },
  ],
  PLACEMENT_OFFICER: [
    { href: "/officer", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/officer/students", label: "Students", icon: Users },
    { href: "/officer/students/import", label: "Import students", icon: FileUp },
    { href: "/officer/companies", label: "Companies", icon: Building2 },
    { href: "/officer/drives", label: "Drives", icon: BriefcaseBusiness },
    { href: "/officer/approvals", label: "Approvals", icon: ClipboardCheck },
    { href: "/officer/policies", label: "Placement policy", icon: Settings2 },
    { href: "/officer/reports", label: "Reports", icon: FileBarChart },
    { href: "/officer/audit", label: "Audit log", icon: ShieldCheck },
    { href: "/officer/notifications", label: "Notifications", icon: Bell },
  ],
  RECRUITER: [
    { href: "/recruiter", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/recruiter/drives", label: "My drives", icon: BriefcaseBusiness },
    { href: "/recruiter/candidates", label: "Candidate search", icon: Search },
    { href: "/recruiter/saved", label: "Saved candidates", icon: Bookmark },
    { href: "/recruiter/drives/request", label: "Request a drive", icon: FileUp },
    { href: "/recruiter/notifications", label: "Notifications", icon: Bell },
  ],
};

export function PortalSidebar({ role, mobile = false }: { role: Role; mobile?: boolean }) {
  const pathname = usePathname();
  const items = NAV[role];

  if (mobile) {
    return (
      <nav aria-label="Mobile navigation" className="scrollbar-thin flex gap-1 overflow-x-auto">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label={`${role.toLowerCase()} navigation`} className="space-y-1">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
        <GraduationCap className="h-4 w-4 shrink-0 text-primary" />
        Campus placement cell
      </div>
    </nav>
  );
}
