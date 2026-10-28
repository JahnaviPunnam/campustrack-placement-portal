import type { Role } from "@/lib/constants";

type Client = {
  id: string;
  channel: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
};

type Hub = {
  clients: Map<string, Set<Client>>;
  byId: Map<string, Client>;
};

const globalForHub = globalThis as unknown as { realtimeHub?: Hub };
const hub: Hub =
  globalForHub.realtimeHub ??
  ({
    clients: new Map(),
    byId: new Map(),
  } satisfies Hub);
globalForHub.realtimeHub = hub;

const encoder = new TextEncoder();

export function userChannel(userId: string) {
  return `user:${userId}`;
}
export function roleChannel(role: Role) {
  return `role:${role}`;
}
export function companyChannel(companyId: string) {
  return `company:${companyId}`;
}

export function subscribe(
  channel: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
): { id: string; close: () => void } {
  const id = crypto.randomUUID();
  const client: Client = { id, channel, controller };
  const set = hub.clients.get(channel) ?? new Set<Client>();
  set.add(client);
  hub.clients.set(channel, set);
  hub.byId.set(id, client);
  sendRaw(controller, ": connected\nretry: 5000\n\n");
  return {
    id,
    close: () => unsubscribe(id),
  };
}

export function unsubscribe(id: string) {
  const client = hub.byId.get(id);
  if (!client) return;
  hub.byId.delete(id);
  const set = hub.clients.get(client.channel);
  if (set) {
    set.delete(client);
    if (set.size === 0) hub.clients.delete(client.channel);
  }
}

function sendRaw(controller: ReadableStreamDefaultController<Uint8Array>, text: string) {
  try {
    controller.enqueue(encoder.encode(text));
  } catch {
    // Controller is already closed; cleanup happens through the abort signal.
  }
}

function publishToChannels(channels: string[], event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const channel of channels) {
    const clients = hub.clients.get(channel);
    if (!clients) continue;
    for (const client of clients) {
      try {
        client.controller.enqueue(encoder.encode(payload));
      } catch {
        unsubscribe(client.id);
      }
    }
  }
}

export function publishToUser(userId: string, event: string, data: unknown) {
  publishToChannels([userChannel(userId)], event, data);
}

export function publishToRole(role: Role, event: string, data: unknown) {
  publishToChannels([roleChannel(role)], event, data);
}

export function publishToCompany(companyId: string, event: string, data: unknown) {
  publishToChannels([companyChannel(companyId)], event, data);
}

export function sendHeartbeat(controller: ReadableStreamDefaultController<Uint8Array>) {
  sendRaw(controller, ": ping\n\n");
}

export function heartbeatAll() {
  for (const client of hub.byId.values()) {
    sendHeartbeat(client.controller);
  }
}

export function connectionCount(): number {
  return hub.byId.size;
}

export function userConnectionCount(userId: string): number {
  return hub.clients.get(userChannel(userId))?.size ?? 0;
}
