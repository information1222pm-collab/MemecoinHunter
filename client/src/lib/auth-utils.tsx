export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message) || 
         error.message.includes('Authentication required') ||
         error.message.includes('Invalid user session');
}

export async function getCsrfToken(): Promise<string> {
  const response = await fetch('/api/csrf-token', {
    credentials: 'include'
  });
  const data = await response.json();
  return data.csrfToken;
}