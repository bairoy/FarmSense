import { authClient, supabaseAdmin } from "../../config/supabase.ts";

export const signUp = async (name: string, email: string, password: string) => {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const user = data.user;
  if (!user) throw new Error("User creation failed");

  const { error: dbError } = await supabaseAdmin
    .from("users")
    .insert({
      id: user.id,
      name,
      email: user.email!,
    });

  if (dbError) {
    // Compensate: delete the auth user to avoid orphaned accounts
    await supabaseAdmin.auth.admin.deleteUser(user.id);
    throw dbError;
  }

  return user;
};

export const signIn = async (email: string, password: string) => {
  // A fresh client, never the shared admin one: signInWithPassword stores the
  // resulting session on whatever client it is called on. Doing this on
  // `supabaseAdmin` left the service-role client authenticated as this user for
  // the rest of the process lifetime.
  const { data, error } = await authClient().auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return {
    user: data.user,
    accessToken: data.session?.access_token,
    refreshToken: data.session?.refresh_token,
  };
};

export const refreshSession = async (refreshToken: string) => {
  // Also a fresh client: refreshSession stores a session too, and the shared
  // anon client is no better a place to strand one than the admin client was.
  const { data, error } = await authClient().auth.refreshSession({
    refresh_token: refreshToken,
  });
  if (error || !data.session) {
    throw new Error("Invalid refresh token");
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
};
