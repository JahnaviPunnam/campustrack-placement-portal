"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import type { Role } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { roleHome } from "@/lib/roles";

export function NotificationBell({ role }: { role: Role }) {
  const [count, setCount] = useState(0);
  const notificationsHref =
    role === "STUDENT"
      ? "/student/notifications"
      : role === "PLACEMENT_OFFICER"
        ? "/officer/notifications"
        : "/recruiter/notifications";

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/notifications?unreadOnly=1&limit=1", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { unreadCount?: number };
        if (active) setCount(data.unreadCount ?? 0);
      } catch {
        // Network errors are handled by the polling retry; the server render still has data.
      }
    }
    load();
    const timer = setInterval(load, 30_000);
    const onRefresh = () => load();
    window.addEventListener("notifications:read", onRefresh);
    window.addEventListener("notifications:created", onRefresh);
    window.addEventListener("notifications:refresh", onRefresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("notifications:read", onRefresh);
      window.removeEventListener("notifications:created", onRefresh);
      window.removeEventListener("notifications:refresh", onRefresh);
    };
  }, []);

  return (
    <Button asChild variant="ghost" size="icon" aria-label={`Notifications${count ? `, ${count} unread` : ""}`}>
      <Link href={notificationsHref} className="relative">
        <Bell className="h-4 w-4" />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
