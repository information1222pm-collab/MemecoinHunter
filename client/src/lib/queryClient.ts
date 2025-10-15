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
      staleTime: 30000, // 30s default - data stays fresh longer
      gcTime: 300000, // 5min cache time
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnReconnect: false, // Don't refetch on reconnect
      retry: 1, // Only retry once on failure
    },
  },
});