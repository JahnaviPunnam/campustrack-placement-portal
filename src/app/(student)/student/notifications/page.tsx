import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/guards";
import { getUserNotifications } from "@/server/services/notifications";
import { PageHeader } from "@/components/shared/page-header";
import { NotificationsPanel } from "@/components/shared/notifications-panel";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function StudentNotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { notifications, unreadCount } = await getUserNotifications(user.id);

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={
          unreadCount > 0
            ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}.`
            : "Drive matches, round updates, and offers appear here."
        }
      />
      <NotificationsPanel
        initial={notifications.map((notification) => ({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          link: notification.link,
          isRead: notification.isRead,
          createdAt: notification.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
