"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/formatting";
import {
  markAllAnyNotificationsReadAction,
  markAnyNotificationReadAction,
} from "@/server/actions/notifications";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

function parseNotification(value: unknown): NotificationItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.title !== "string") return null;
  return {
    id: item.id,
    type: typeof item.type === "string" ? item.type : "SYSTEM",
    title: item.title,
    body: typeof item.body === "string" ? item.body : "",
    link: typeof item.link === "string" ? item.link : null,
    isRead: item.isRead === true,
    createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
  };
}

export function NotificationsPanel({ initial }: { initial: NotificationItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const unread = items.filter((item) => !item.isRead).length;
  const visible = filter === "unread" ? items.filter((item) => !item.isRead) : items;

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  useEffect(() => {
    let active = true;

    const onCreated = (event: Event) => {
      const item = parseNotification((event as CustomEvent<unknown>).detail);
      if (!item) return;
      setItems((current) => {
        if (current.some((entry) => entry.id === item.id)) return current;
        return [item, ...current].slice(0, 50);
      });
    };

    const onRefresh = async () => {
      try {
        const response = await fetch("/api/notifications?limit=50", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { notifications?: unknown };
        if (!active || !Array.isArray(data.notifications)) return;
        const next = data.notifications
          .map(parseNotification)
          .filter((item): item is NotificationItem => item !== null);
        setItems(next);
      } catch {
        // The next polling tick retries; the server-rendered list stays usable meanwhile.
      }
    };

    window.addEventListener("notifications:created", onCreated);
    window.addEventListener("notifications:refresh", onRefresh);
    return () => {
      active = false;
      window.removeEventListener("notifications:created", onCreated);
      window.removeEventListener("notifications:refresh", onRefresh);
    };
  }, []);

  async function markRead(id: string) {
    setLoadingId(id);
    const result = await markAnyNotificationReadAction({ notificationId: id });
    setLoadingId(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setItems((current) => current.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    window.dispatchEvent(new Event("notifications:read"));
    router.refresh();
  }

  async function markAll() {
    setMarkingAll(true);
    const result = await markAllAnyNotificationsReadAction();
    setMarkingAll(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    window.dispatchEvent(new Event("notifications:read"));
    toast.success("All notifications marked read.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <Button
            type="button"
            size="sm"
            variant={filter === "all" ? "secondary" : "ghost"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filter === "unread" ? "secondary" : "ghost"}
            onClick={() => setFilter("unread")}
          >
            Unread {unread > 0 ? `(${unread})` : ""}
          </Button>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={markAll} disabled={markingAll || unread === 0}>
          {markingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
          Mark all read
        </Button>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
          <Bell className="mb-3 h-7 w-7 text-muted-foreground" />
          <p className="font-medium">You&apos;re all caught up</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filter === "unread" ? "No unread notifications." : "Notifications will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((item) => {
            const content = (
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    item.isRead ? "bg-transparent" : "bg-primary",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn("text-sm", item.isRead ? "font-medium" : "font-semibold")}>{item.title}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {item.type.replaceAll("_", " ").toLowerCase()}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{item.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{relativeTime(item.createdAt)}</p>
                </div>
                {!item.isRead ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void markRead(item.id);
                    }}
                    disabled={loadingId === item.id}
                  >
                    {loadingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Mark read"}
                  </Button>
                ) : null}
              </div>
            );
            return (
              <Card key={item.id} className={cn(!item.isRead && "border-primary/30 bg-primary/[0.02]")}>
                <CardContent className="p-4">
                  {item.link ? (
                    <Link href={item.link} className="block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
