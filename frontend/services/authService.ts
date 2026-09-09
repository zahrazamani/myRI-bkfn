// Authentication is by email address.
// The user identifies themselves with their email; it is stored locally and
// used to identify their chat sessions. There is no password / server-side
// verification yet — this is a lightweight client-side identity.
const AUTH_EMAIL_KEY = 'mri-user-email';

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
  } catch (error) {
    console.error("Could not remove from localStorage", error);
  }
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
