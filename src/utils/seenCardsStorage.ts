/**
 * Manages a list of "seen" postcard IDs in localStorage.
 * Used to prioritize unseen postcards in the feed.
 *
 * Capped at MAX_SEEN to avoid bloating localStorage.
 * When the cap is exceeded, the oldest entries are pruned.
 */

const STORAGE_KEY = 'postalpeek_seen_cards';
const MAX_SEEN = 200;

/** Get all seen card IDs */
export function getSeenCardIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Mark one or more card IDs as seen */
export function markCardsSeen(ids: string[]): void {
  try {
    const existing = new Set(getSeenCardIds());
    for (const id of ids) {
      existing.add(id);
    }

    // Convert to array, keep only the most recent MAX_SEEN entries
    let arr = Array.from(existing);
    if (arr.length > MAX_SEEN) {
      arr = arr.slice(arr.length - MAX_SEEN);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/** Clear all seen card data (e.g. for testing / reset) */
export function clearSeenCards(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
