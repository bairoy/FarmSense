import * as Crypto from "expo-crypto";
import * as SQLite from "expo-sqlite";

import { api } from "@/lib/api";

/**
 * The offline write queue.
 *
 * Irrigation/fertilizer logs, check-in answers and disease photos can all be
 * created with no connectivity in the field. Each queued item gets a
 * `client_request_id` (this row's `id`) that travels with the eventual
 * request; the matching backend endpoints dedupe on it (see
 * backend/supabase/migrations/20260922000000_offline_idempotency_keys.sql),
 * so retrying a flush after a dropped response never creates a duplicate.
 *
 * Rows are processed strictly in insertion order and one at a time - a weak
 * rural connection is the reason this queue exists, so flushing five requests
 * in parallel onto it would just make all five time out instead of one.
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

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const getDb = () => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("farmsense-outbox.db").then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS outbox (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          crop_instance_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          photo_uri TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          error TEXT,
          retries INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
      `);
      return db;
    });
  }
  return dbPromise;
};

export const enqueueOutboxItem = async (
  kind: OutboxKind,
  cropInstanceId: string,
  payload: Record<string, unknown>,
  photoUri?: string,
  /**
   * Reuse an id already generated for this write (the disease screen tries
   * the request directly first, for its immediate diagnosis result, and only
   * falls back to the queue on a network failure — reusing the same
   * client_request_id means that fallback can't create a duplicate even if
   * the direct attempt actually reached the server).
   */
  id: string = Crypto.randomUUID()
): Promise<string> => {
  const db = await getDb();

  await db.runAsync(
    "INSERT INTO outbox (id, kind, crop_instance_id, payload, photo_uri, status, retries, created_at) VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)",
    id,
    kind,
    cropInstanceId,
    JSON.stringify(payload),
    photoUri ?? null,
    new Date().toISOString()
  );

  notifyOutboxChanged();
  return id;
};

export const listOutboxForCrop = async (cropInstanceId: string): Promise<OutboxItem[]> => {
  const db = await getDb();
  return db.getAllAsync<OutboxItem>(
    "SELECT * FROM outbox WHERE crop_instance_id = ? ORDER BY created_at ASC",
    cropInstanceId
  );
};

/** All queued items across every crop, newest first — powers the dashboard's pending-activity list. */
export const listAllOutbox = async (): Promise<OutboxItem[]> => {
  const db = await getDb();
  return db.getAllAsync<OutboxItem>("SELECT * FROM outbox ORDER BY created_at DESC");
};

const removeItem = async (id: string) => {
  const db = await getDb();
  await db.runAsync("DELETE FROM outbox WHERE id = ?", id);
};

const markFailed = async (id: string, error: string) => {
  const db = await getDb();
  await db.runAsync(
    "UPDATE outbox SET status = 'failed', error = ?, retries = retries + 1 WHERE id = ?",
    error,
    id
  );
};

const bumpRetry = async (id: string) => {
  const db = await getDb();
  await db.runAsync("UPDATE outbox SET retries = retries + 1 WHERE id = ?", id);
};

/** A response the server actually answered with, meaning the request is resolved
 *  one way or another - retrying it would not help. Anything else (no response
 *  at all) is a connectivity failure and stays queued for the next flush. */
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
    form.append("file", {
      uri: item.photo_uri,
      name: "leaf.jpg",
      type: "image/jpeg",
    } as unknown as Blob);
    form.append("taken_on", payload.taken_on);
    form.append("client_request_id", item.id);
    await api.post(`/disease/crop/${item.crop_instance_id}/analyse`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 90_000,
    });
    return;
  }
};

/**
 * Processes every queued item once, in order. Call on reconnect and on app
 * foreground. Safe to call concurrently - callers don't need to serialise
 * their own calls, this one drains whatever is queued at the time it runs.
 */
export const flushOutbox = async () => {
  const db = await getDb();
  const items = await db.getAllAsync<OutboxItem>(
    "SELECT * FROM outbox WHERE status IN ('pending', 'failed') ORDER BY created_at ASC"
  );

  for (const item of items) {
    try {
      await sendItem(item);
      await removeItem(item.id);
    } catch (err) {
      if (isServerAnswered(err)) {
        // The server rejected it outright (validation, ownership, etc.) - retrying
        // the same payload will not change that. Surface it instead of looping.
        const message =
          (err as any).response?.data?.error ?? "The server rejected this entry.";
        await markFailed(item.id, message);
      } else {
        // No response at all: still offline, or the connection dropped mid-request.
        // Leave it queued and stop this flush - later items would fail the same way.
        await bumpRetry(item.id);
        break;
      }
    }
  }

  notifyOutboxChanged();
};

export const outboxCounts = async () => {
  const db = await getDb();
  const pending = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM outbox WHERE status = 'pending'"
  );
  const failed = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM outbox WHERE status = 'failed'"
  );
  return { pending: pending?.count ?? 0, failed: failed?.count ?? 0 };
};
