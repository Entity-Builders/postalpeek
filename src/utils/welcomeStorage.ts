// ─── localStorage helpers for Walker Welcome onboarding ───

const STORAGE_KEY = 'postalpeek_welcomed';

/** Check if this device has already seen the Walker welcome */
export function hasSeenWelcome(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Mark the welcome as seen so it doesn't show again */
export function markWelcomeSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // localStorage may be unavailable (private browsing, etc.)
  }
}
