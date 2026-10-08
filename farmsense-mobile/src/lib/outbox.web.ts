import { api } from "@/lib/api";

/**
 * Web-only stand-in for the SQLite-backed outbox (outbox.ts).
 *
 * expo-sqlite's web build depends on a WASM worker chunk that fails to
 * bundle under `expo start --web` / `expo export --platform web` in this
 * project's Metro setup. The shipped app targets Android/iOS only — web is
 * a dev-preview convenience — so rather than fight that bundling error, web
 * gets a functionally equivalent in-memory queue: same exported API, lost on
 * page reload instead of persisted. Native builds are unaffected; this file
 * is never bundled into them.
 */

type OutboxListener = () => void;
const outboxListeners = new Set<OutboxListener>();

/** Lets the in-memory counts store refresh without this module importing it (that import would cycle). */
export const subscribeToOutboxChanges = (listener: OutboxListener) => {
  outboxListeners.add(listener);
  return () => {
    outboxListeners.delete(listener);
  };
};

const notifyOutboxChanged = () => outboxListeners.forEach((listener) => listener());

export type OutboxKind = "irrigation" | "fertilizer" | "disease";

export interface OutboxItem {
  id: string;
  kind: OutboxKind;
  crop_instance_id: string;
  payload: string;
  photo_uri: string | null;
  status: "pending" | "failed";
  error: string | null;
  retries: number;
  created_at: string;
}

let items: OutboxItem[] = [];

const randomId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const enqueueOutboxItem = async (
  kind: OutboxKind,
  cropInstanceId: string,
  payload: Record<string, unknown>,
  photoUri?: string,
  id: string = randomId()
): Promise<string> => {
  items = [
    ...items,
    {
      id,
      kind,
      crop_instance_id: cropInstanceId,
      payload: JSON.stringify(payload),
      photo_uri: photoUri ?? null,
      status: "pending",
      error: null,
      retries: 0,
      created_at: new Date().toISOString(),
    },
  ];
  notifyOutboxChanged();
  return id;
};

export const listOutboxForCrop = async (cropInstanceId: string): Promise<OutboxItem[]> =>
  items.filter((item) => item.crop_instance_id === cropInstanceId);

export const listAllOutbox = async (): Promise<OutboxItem[]> =>
  [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));

export const isServerAnswered = (err: unknown): boolean =>
  typeof err === "object" && err !== null && "response" in err && (err as any).response != null;

const sendItem = async (item: OutboxItem) => {
  const payload = JSON.parse(item.payload);

  if (item.kind === "irrigation") {
    await api.post("/irrigation", { ...payload, client_request_id: item.id });
    return;
  }
  if (item.kind === "fertilizer") {
    await api.post("/fertilizer", { ...payload, client_request_id: item.id });
    return;
  }
  if (item.kind === "disease") {
    const form = new FormData();
    form.append("file", { uri: item.photo_uri, name: "leaf.jpg", type: "image/jpeg" } as unknown as Blob);
    form.append("taken_on", payload.taken_on);
    form.append("client_request_id", item.id);
    await api.post(`/disease/crop/${item.crop_instance_id}/analyse`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 90_000,
    });
  }
};

export const flushOutbox = async () => {
  for (const item of items.filter((i) => i.status === "pending" || i.status === "failed")) {
    try {
      await sendItem(item);
      items = items.filter((i) => i.id !== item.id);
    } catch (err) {
      if (isServerAnswered(err)) {
        const message = (err as any).response?.data?.error ?? "The server rejected this entry.";
        items = items.map((i) => (i.id === item.id ? { ...i, status: "failed", error: message } : i));
      } else {
        break;
      }
    }
  }
  notifyOutboxChanged();
};

export const outboxCounts = async () => ({
  pending: items.filter((i) => i.status === "pending").length,
  failed: items.filter((i) => i.status === "failed").length,
});
