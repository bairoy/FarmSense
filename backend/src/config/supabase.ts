import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types.ts";
import { env } from "./env.ts";

export const supabase = createClient<Database>(
  env.supabaseUrl,
  env.supabaseAnonKey
);

export const supabaseAdmin = createClient<Database>(
  env.supabaseUrl,
  env.supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
