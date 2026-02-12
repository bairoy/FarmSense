import {createClient} from "@supabase/supabase-js";
import type  {Database} from "../types/database.types";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!
const SUPABASE_PUBLISHABLE_OR_ANON_KEY=process.env.SUPABASE_PUBLISHABLE_OR_ANON_KEY!
const SUPABASE_SERVICE_ROLE_KEY= process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient<Database>(
  supabaseUrl,
  SUPABASE_PUBLISHABLE_OR_ANON_KEY
);
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  SUPABASE_SERVICE_ROLE_KEY,{
    auth:{
      persistSession:false,
      autoRefreshToken:false
    }
  }
);