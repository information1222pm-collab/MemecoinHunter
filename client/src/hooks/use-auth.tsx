import { useQuery } from "@tanstack/react-query";

export interface User {
  id: string;
  username: string;
  email: string;
  subscriptionTier: 'basic' | 'premium' | 'pro';
}

interface AuthStatusResponse {
  authenticated: boolean;
  userId?: string;
  userEmail?: string;
}

export function useAuth() {
  const { data: authData, isLoading, refetch, error } = useQuery<AuthStatusResponse>({
    queryKey: ["/api/auth/me"],
    retry: (failureCount, error: any) => {
      // Don't retry on 429 rate limit errors
      if (error?.message?.includes('429') || error?.status === 429) {
        return false;
      }
      return failureCount < 1;
    },
    retryDelay: 5000, // Wait 5 seconds before retry
    refetchInterval: false, // Disable auto-refetch
    refetchOnWindowFocus: false, // Disable refetch on window focus
    refetchOnMount: false, // Only fetch once per mount
    staleTime: Infinity, // Never consider stale once loaded
    gcTime: 60 * 60 * 1000, // Cache for 1 hour
  });

  const user = (authData && authData.authenticated && authData.userId && authData.userEmail) ? {
    id: authData.userId,
    email: authData.userEmail,
    username: authData.userEmail.split('@')[0] || 'user',
    subscriptionTier: 'basic' as const
  } : null;

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    refetch
  };
}