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

export function markWelcomeSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
    window.dispatchEvent(new Event('postalpeek_welcome_seen'));
  } catch {
    // localStorage may be unavailable (private browsing, etc.)
  }
}
