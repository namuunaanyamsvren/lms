import { QueryClient } from '@tanstack/react-query';

// Network-level retry for idempotent requests already happens in apiClient.js,
// so React Query itself does not need to retry on top of that.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 15_000,
      refetchOnWindowFocus: false,
    },
  },
});
