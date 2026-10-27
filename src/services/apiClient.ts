function getApiBaseUrl(): string {
  if (import.meta.env?.VITE_API_BASE_URL) {
    let base = (import.meta.env.VITE_API_BASE_URL as string).trim().replace(/\/$/, '');
    if (base.endsWith('/api')) {
      base = base.slice(0, -4);
    }
    return base;
  }

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    // In local development (e.g. running Vite dev server on port 5173), target backend on port 4000
    if (isLocalhost && window.location?.port !== '4000') {
      return 'http://localhost:4000';
    }
    // In production or same-origin deployment, empty base means same-origin relative URL (/api/...)
    return '';
  }

  return 'http://localhost:4000';
}

const API_BASE_URL = getApiBaseUrl();

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let authHeaders: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    const participantToken = localStorage.getItem('bb_participant_token');
    const adminToken = localStorage.getItem('bb_admin_token');
    const isAdminRoute = path.startsWith('/admin') || path.startsWith('/auth/admin');
    // Ensure strict role separation: never send participant token to admin route or vice-versa
    const token = isAdminRoute ? adminToken : participantToken;
    if (token) {
      authHeaders = { Authorization: `Bearer ${token}` };
    }
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const targetUrl = API_BASE_URL ? `${API_BASE_URL}/api${cleanPath}` : `/api${cleanPath}`;

  const response = await fetch(targetUrl, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders,
      ...init.headers,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new ApiError(payload.error || `Request failed (${response.status})`, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
