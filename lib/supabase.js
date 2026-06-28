// Server-side Supabase client. Uses the SERVICE ROLE key, which bypasses
// Row Level Security — so this must NEVER be imported into client components.
import { createClient } from '@supabase/supabase-js';

let _client = null;

// Lazy: only build the client when a request actually needs it. This keeps the
// production build from trying to create it before env vars exist.
export function getSupabaseAdmin() {
  if (_client) return _client;
  _client = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  return _client;
}

// Single hardcoded user for Phase 1 (no login yet).
export const PHASE1_USER_ID = '00000000-0000-0000-0000-000000000001';
