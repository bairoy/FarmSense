import { create } from "zustand";

import { outboxCounts, subscribeToOutboxChanges } from "@/lib/outbox";

interface OutboxState {
  pending: number;
  failed: number;
  refresh: () => Promise<void>;
}

/**
 * In-memory mirror of the SQLite outbox's counts, for the header badge.
 * SQLite reads are async, so components read this instead of polling the DB
 * on every render; `refresh()` is called by outbox.ts after every mutation.
 */
export const useOutboxStore = create<OutboxState>((set) => ({
  pending: 0,
  failed: 0,
  refresh: async () => {
    const counts = await outboxCounts();
    set(counts);
  },
}));

subscribeToOutboxChanges(() => {
  void useOutboxStore.getState().refresh();
});
