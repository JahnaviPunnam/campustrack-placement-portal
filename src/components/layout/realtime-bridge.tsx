"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const EVENT_TYPES = [
  "notification.created",
  "application.updated",
  "offer.created",
  "round.updated",
  "drive.pipeline.updated",
  "drive.published",
  "drive.status",
  "drive.requested",
  "drive.eligibility.updated",
] as const;

export function RealtimeBridge() {
  const router = useRouter();

  useEffect(() => {
    let source: EventSource | null = null;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    const seenNotifications = new Set<string>();

    const scheduleRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        router.refresh();
      }, 400);
    };

    const startFallback = () => {
      if (fallbackTimer) return;
      fallbackTimer = setInterval(() => {
        window.dispatchEvent(new Event("notifications:refresh"));
        scheduleRefresh();
      }, 12_000);
    };

    const stopFallback = () => {
      if (!fallbackTimer) return;
      clearInterval(fallbackTimer);
      fallbackTimer = null;
    };

    const onEvent = (event: MessageEvent<string>) => {
      let data: unknown;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!data || typeof data !== "object") return;

      if (event.type === "notification.created") {
        const id = "id" in data && typeof data.id === "string" ? data.id : null;
        if (id) {
          if (seenNotifications.has(id)) return;
          seenNotifications.add(id);
          if (seenNotifications.size > 200) {
            const oldest = seenNotifications.values().next().value;
            if (oldest) seenNotifications.delete(oldest);
          }
          window.dispatchEvent(new CustomEvent("notifications:created", { detail: data }));
        }
      }

      window.dispatchEvent(
        new CustomEvent("realtime:event", { detail: { type: event.type, data } }),
      );
      scheduleRefresh();
    };

    const connect = () => {
      if (disposed) return;
      source = new EventSource("/api/notifications/stream");
      source.onopen = () => stopFallback();
      source.onerror = () => startFallback();
      for (const type of EVENT_TYPES) {
        source.addEventListener(type, (event) => onEvent(event as MessageEvent<string>));
      }
    };

    connect();
    startFallback();

    return () => {
      disposed = true;
      source?.close();
      stopFallback();
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [router]);

  return null;
}
