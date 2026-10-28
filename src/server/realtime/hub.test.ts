import { describe, expect, it } from "vitest";
import {
  connectionCount,
  publishToRole,
  publishToUser,
  roleChannel,
  sendHeartbeat,
  subscribe,
  unsubscribe,
  userChannel,
} from "./hub";

function createController() {
  const chunks: string[] = [];
  const controller = {
    enqueue(value: Uint8Array) {
      chunks.push(new TextDecoder().decode(value));
    },
    close() {},
  } as unknown as ReadableStreamDefaultController<Uint8Array>;
  return { chunks, controller };
}

describe("realtime hub", () => {
  it("fans out user events and stops after unsubscribe", () => {
    const userId = `hub-user-${crypto.randomUUID()}`;
    const { chunks, controller } = createController();
    const subscription = subscribe(userChannel(userId), controller);
    chunks.length = 0;

    publishToUser(userId, "application.updated", { applicationId: "app-1" });
    expect(chunks.join("")).toContain("event: application.updated");
    expect(chunks.join("")).toContain('"applicationId":"app-1"');

    unsubscribe(subscription.id);
    publishToUser(userId, "application.updated", { applicationId: "app-2" });
    expect(chunks.join("")).not.toContain("app-2");
  });

  it("fans out role events and tracks connection counts", () => {
    const role = `PLACEMENT_OFFICER` as const;
    const before = connectionCount();
    const { chunks, controller } = createController();
    const subscription = subscribe(roleChannel(role), controller);
    chunks.length = 0;

    publishToRole(role, "drive.pipeline.updated", { driveId: "drive-1" });
    expect(chunks.join("")).toContain("event: drive.pipeline.updated");
    expect(chunks.join("")).toContain('"driveId":"drive-1"');
    expect(connectionCount()).toBeGreaterThan(before);

    unsubscribe(subscription.id);
    expect(connectionCount()).toBe(before);
  });

  it("writes heartbeat comments", () => {
    const { chunks, controller } = createController();
    sendHeartbeat(controller);
    expect(chunks.join("")).toBe(": ping\n\n");
  });
});
