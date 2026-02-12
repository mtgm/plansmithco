import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
// Accept either VITE_SUPABASE_KEY or VITE_SUPABASE_ANON_KEY (common naming)
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "❌ Supabase URL and Key are required! Set VITE_SUPABASE_URL and VITE_SUPABASE_KEY (or VITE_SUPABASE_ANON_KEY) in your .env."
  );
}

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Type definitions (will be expanded later)
export type Database = any;

// Log for debugging (optional)
console.log("✅ Supabase client initialized");
console.log("📍 URL:", SUPABASE_URL);