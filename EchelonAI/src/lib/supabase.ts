import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

// If env vars are missing, supabase stays null and the UI shows a config-needed state
// rather than crashing.
export const supabase =
  url && key && url !== "REPLACE_ME" && key !== "REPLACE_ME"
    ? createClient(url, key)
    : null;

export const supabaseConfigured = supabase !== null;
