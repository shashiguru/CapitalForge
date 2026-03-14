import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

function createClientInstance(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Don't set custom storageKey - let Supabase use its default based on project ref
    },
  });
}

// Singleton instance - only created on client side
let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (typeof window === 'undefined') {
    // Server-side: create a new instance (won't have session)
    return createClientInstance();
  }

  // Client-side: use singleton
  if (!supabaseInstance) {
    supabaseInstance = createClientInstance();
  }
  return supabaseInstance;
}

export { createClientInstance as createClient };
