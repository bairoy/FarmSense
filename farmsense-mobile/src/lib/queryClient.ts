import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Offline-first: show cached data immediately, refetch in the background
      // rather than blocking the screen on a network round trip that may
      // never complete on a rural connection.
      staleTime: 5 * 60 * 1000,
      retry: 2,
      networkMode: "offlineFirst",
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
});
