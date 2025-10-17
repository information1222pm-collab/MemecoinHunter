import { QueryClient } from "@tanstack/react-query";

async function handleRequest(
  method: string,
  url: string,
  body?: unknown
): Promise<Response> {
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  return response;
}

export async function apiRequest(
  method: string,
  url: string,
  body?: unknown
): Promise<any> {
  const response = await handleRequest(method, url, body);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMessage);
    (error as any).status = response.status;
    throw error;
  }

  return response;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const url = queryKey[0] as string;
        const response = await apiRequest("GET", url);
        return response.json();
      },
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh much longer
      gcTime: 30 * 60 * 1000, // 30 minutes cache time - keep data much longer
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnReconnect: false, // Don't refetch on reconnect
      retry: 1, // Only retry once on failure
      placeholderData: (previousData: any) => previousData, // Keep previous data while fetching
    },
    mutations: {
      retry: 0, // Don't retry mutations by default
    },
  },
});

// Prefetch helper for navigation
export async function prefetchQuery(queryKey: string | string[]) {
  const key = Array.isArray(queryKey) ? queryKey : [queryKey];
  return queryClient.prefetchQuery({
    queryKey: key,
    staleTime: 10 * 60 * 1000, // 10 minutes for prefetched data
  });
}

// Batch prefetch helper for multiple queries
export async function prefetchQueries(queryKeys: (string | string[])[]) {
  return Promise.all(queryKeys.map(key => prefetchQuery(key)));
}