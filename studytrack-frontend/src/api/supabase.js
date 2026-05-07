import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// AsyncStorage is required (not SecureStore) so that Supabase can persist the
// PKCE code verifier between signInWithOAuth and exchangeCodeForSession.
// flowType: 'pkce' ensures Supabase never silently falls back to implicit flow.
export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  }
);

export default supabase;
