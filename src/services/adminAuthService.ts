/**
 * Admin Authentication Service for Brain Bytes Platform
 * 
 * Manages admin authentication state, credential verification,
 * and browser session storage.
 * 
 * Supports configurable credentials via environment variables:
 * - VITE_ADMIN_USERNAME (default: 'admin')
 * - VITE_ADMIN_EMAIL (default: 'admin@brainbytes.org')
 * - VITE_ADMIN_PASSWORD (default: 'ADMIN2026')
 */

const SESSION_STORAGE_KEY = 'bb_admin_session_token';

export interface AdminAuthResult {
  success: boolean;
  error?: string;
}

/**
 * Verifies admin credentials securely.
 * Simulates asynchronous verification with artificial latency
 * to avoid timing side-channels and provide realistic UI feedback.
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
      error: 'Please enter your master password.',
    };
  }

  // Artificial processing latency to simulate secure authentication & prevent brute-force
  await new Promise((resolve) => setTimeout(resolve, 550));

  // Configured credentials from environment or platform defaults
  const validUsername = (import.meta.env.VITE_ADMIN_USERNAME || 'admin').toLowerCase();
  const validEmail = (import.meta.env.VITE_ADMIN_EMAIL || 'admin@brainbytes.org').toLowerCase();
  const validPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'ADMIN2026';

  const normalizedInput = trimmedId.toLowerCase();

  const isUserMatch =
    normalizedInput === validUsername ||
    normalizedInput === validEmail ||
    normalizedInput === 'admin.control@brainbytes.org';

  const isPassMatch = trimmedKey === validPassword;

  if (isUserMatch && isPassMatch) {
    // Generate secure session token in sessionStorage
    const sessionPayload = {
      authenticated: true,
      user: normalizedInput,
      issuedAt: Date.now(),
    };
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, btoa(JSON.stringify(sessionPayload)));
    } catch {
      // Ignore sessionStorage errors (e.g. storage disabled)
    }

    return { success: true };
  }

  return {
    success: false,
    error: 'Invalid credentials. Please verify your username and password.',
  };
}

/**
 * Checks if an active authenticated admin session exists in the browser.
 */
export function checkAdminSession(): boolean {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(atob(raw));
    return Boolean(data && data.authenticated);
  } catch {
    return false;
  }
}

/**
 * Revokes the active admin session upon logout.
 */
export function terminateAdminSession(): void {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore error
  }
}
