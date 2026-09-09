// Authentication.
// Two modes:
//  - Google Sign-In (S4): when VITE_GOOGLE_CLIENT_ID is set, the user signs in
//    with Google. The backend verifies the ID token and per-user daily caps key
//    off the verified Google account id, so they can't be bypassed by typing a
//    fresh email.
//  - Email only (dev / soft launch): an unverified email string, stored locally.
const AUTH_EMAIL_KEY = 'mri-user-email';
// Kept in step with geminiService.HUMAN_TOKEN_KEY - the bearer token sent on
// /chat, /illustrate and /log/session. A Google session reuses this slot.
const HUMAN_TOKEN_KEY = 'mri-human-token';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
export const isGoogleAuthEnabled = (): boolean => !!GOOGLE_CLIENT_ID;

/**
 * Exchange a Google Identity Services credential (ID token) for a MYRI session.
 * On success the verified email is stored and the backend session token is
 * saved as the bearer token. Returns the email, or null on failure.
 */
export const loginWithGoogle = async (credential: string): Promise<string | null> => {
  try {
    const res = await fetch(`${API_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const email = (data.email || '').trim().toLowerCase();
    try {
      if (email) localStorage.setItem(AUTH_EMAIL_KEY, email);
      if (data.token) localStorage.setItem(HUMAN_TOKEN_KEY, data.token);
    } catch { /* private mode - session just won't persist */ }
    return email || 'signed-in';
  } catch {
    return null;
  }
};

// Simple, permissive email shape check: something@something.tld
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Checks whether a string looks like a valid email address.
 */
export const isValidEmail = (email: string): boolean => EMAIL_REGEX.test(email.trim());

/**
 * Attempts to log a user in with their email address.
 * @param email - The email entered by the user.
 * @returns True if the email is valid (and was stored), false otherwise.
 */
export const login = (email: string): boolean => {
  const normalized = email.trim().toLowerCase();
  if (!isValidEmail(normalized)) {
    return false;
  }
  try {
    localStorage.setItem(AUTH_EMAIL_KEY, normalized);
  } catch (error) {
    console.error("Could not save to localStorage", error);
    // If localStorage is unavailable, the session just won't persist.
  }
  return true;
};

/**
 * Logs out the current user by removing their email from localStorage.
 */
export const logout = (): void => {
  try {
    localStorage.removeItem(AUTH_EMAIL_KEY);
    localStorage.removeItem(HUMAN_TOKEN_KEY);
  } catch (error) {
    console.error("Could not remove from localStorage", error);
  }
  try {
    // Stop Google auto-selecting the same account on the next visit.
    (window as any).google?.accounts?.id?.disableAutoSelect?.();
  } catch { /* ignore */ }
};

/**
 * Returns the currently logged-in user's email, or null if not logged in.
 */
export const getCurrentUser = (): string | null => {
  try {
    const email = localStorage.getItem(AUTH_EMAIL_KEY);
    return email && isValidEmail(email) ? email : null;
  } catch (error) {
    console.error("Could not read from localStorage", error);
    return null;
  }
};

/**
 * Checks if the current user is authenticated.
 * @returns True if a valid email is stored, false otherwise.
 */
export const isAuthenticated = (): boolean => getCurrentUser() !== null;
