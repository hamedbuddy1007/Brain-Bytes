import { apiRequest, ApiError } from './apiClient';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
}

export interface AdminAuthResult {
  success: boolean;
  error?: string;
  admin?: AdminUser;
}

/**
 * Authenticates admin credentials via POST /api/auth/admin/login.
 * On success, the backend sets an HTTP-only session cookie.
 */
export async function authenticateAdmin(
  identifier: string,
  key: string
): Promise<AdminAuthResult> {
  const trimmedId = identifier.trim();
  const trimmedKey = key.trim();

  // Field validation
  if (!trimmedId) {
    return {
      success: false,
      error: 'Please enter your username or email address.',
    };
  }

  if (!trimmedKey) {
    return {
      success: false,
      error: 'Please enter your password.',
    };
  }

  try {
    const admin = await apiRequest<AdminUser & { token?: string }>('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: trimmedId,
        password: trimmedKey,
      }),
    });

    localStorage.setItem('bb_admin_token', admin.token || 'active');

    return {
      success: true,
      admin,
    };
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return {
        success: false,
        error: err.message || 'Invalid credentials. Please verify your username and password.',
      };
    }
    if (err instanceof Error) {
      if (err.message.includes('VITE_API_BASE_URL is not configured')) {
        return {
          success: false,
          error: 'Backend API URL is not configured. Please set VITE_API_BASE_URL.',
        };
      }
      if (err.message.includes('Failed to fetch') || err.name === 'TypeError') {
        return {
          success: false,
          error: 'Unable to connect to the backend server. Please verify the API is running.',
        };
      }
      return {
        success: false,
        error: err.message,
      };
    }
    return {
      success: false,
      error: 'An unexpected authentication error occurred. Please try again.',
    };
  }
}

/**
 * Verifies/restores an active authenticated admin session using GET /api/auth/admin/me.
 */
export async function checkAdminSession(): Promise<boolean> {
  try {
    const admin = await apiRequest<AdminUser>('/auth/admin/me');
    if (admin && admin.id) {
      if (!localStorage.getItem('bb_admin_token')) {
        localStorage.setItem('bb_admin_token', 'active');
      }
      return true;
    }
    localStorage.removeItem('bb_admin_token');
    return false;
  } catch {
    localStorage.removeItem('bb_admin_token');
    return false;
  }
}

/**
 * Revokes the active admin session upon logout via POST /api/auth/logout.
 */
export async function terminateAdminSession(): Promise<void> {
  try {
    localStorage.removeItem('bb_admin_token');
    await apiRequest('/auth/logout', {
      method: 'POST',
    });
  } catch {
    // Client-side sign out should proceed even if network is unavailable
  }
}
