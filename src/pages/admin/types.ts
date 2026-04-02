/**
 * Shared types for Admin sub-pages.
 */

import type { User } from '@supabase/supabase-js';

export interface AdminOutletContext {
  user: User | null;
  onPostcardGenerated: () => void;
  refetchLog: () => void;
}
