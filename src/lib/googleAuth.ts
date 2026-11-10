import supabase from './supabase';

/** Google credentials and the provider callback are managed by Supabase Auth. */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/login`,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
}
