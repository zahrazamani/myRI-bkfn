// A simple list of approved access codes.
// In a real-world application, this would be managed by a secure backend system.
const APPROVED_CODES = ['Bagheri1404', 'Zamani1404', 'Motevallian1404', 'GUEST1404'];
const AUTH_TOKEN_KEY = 'mri-auth-token';

/**
 * Attempts to log in a user with an access code.
 * @param accessCode - The code entered by the user.
 * @returns True if the code is valid, false otherwise.
 */
export const login = (accessCode: string): boolean => {
  if (APPROVED_CODES.includes(accessCode.trim())) {
    try {
      localStorage.setItem(AUTH_TOKEN_KEY, accessCode.trim());
      return true;
    } catch (error) {
      console.error("Could not save to localStorage", error);
      // If localStorage is not available, the session will not be persisted.
      return true;
    }
  }
  return false;
};

/**
 * Logs out the current user by removing their token from localStorage.
 */
export const logout = (): void => {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (error) {
    console.error("Could not remove from localStorage", error);
  }
};

/**
 * Checks if the current user is authenticated.
 * @returns True if a valid access code is found in localStorage, false otherwise.
 */
export const isAuthenticated = (): boolean => {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    return token !== null && APPROVED_CODES.includes(token);
  } catch (error) {
    console.error("Could not read from localStorage", error);
    return false;
  }
};
