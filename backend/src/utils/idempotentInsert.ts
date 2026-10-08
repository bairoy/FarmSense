import type { Db } from "../config/supabase.ts";

type IdempotentTable = "irrigation_actions" | "fertilizer_actions" | "crop_images";

/**
 * Insert-or-return-existing, keyed on (crop_instance_id, client_request_id).
 *
 * The mobile app queues writes made offline and retries them until it gets a
 * response. If a request reached the server but its reply was lost (the
 * common failure on a rural connection), a naive retry would insert the same
 * irrigation log, fertilizer log, check-in answer or photo diagnosis twice.
 * `client_request_id` is a UUID the client generates once per queued item and
 * resends on every retry; a unique index on the pair (see migration
 * 20260922000000) turns a duplicate insert into a Postgres 23505, which this
 * catches and resolves by returning the row that already exists instead of
 * erroring.
 *
 * A request with no `client_request_id` (anything from the web app, which has
 * no offline queue) behaves exactly as a plain insert always has.
 */
export const insertIdempotent = async <T>(
  db: Db,
  table: IdempotentTable,
  row: Record<string, unknown> & {
    crop_instance_id: string;
    client_request_id?: string | null;
  }
): Promise<T> => {
  const { data, error } = await db.from(table).insert(row as never).select().single();

  if (!error) return data as T;

  if (error.code === "23505" && row.client_request_id) {
    const { data: existing, error: selectError } = await db
      .from(table)
      .select("*")
      .eq("crop_instance_id", row.crop_instance_id)
      .eq("client_request_id", row.client_request_id)
      .single();

    if (selectError) throw selectError;
    return existing as T;
  }

  throw error;
};
