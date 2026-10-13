const supabase = require('../../lib/supabase');
const { createPublicClient } = require('../../lib/supabasePublic'); // NEW

class EmailTakenError extends Error {}
class InvalidCredentialsError extends Error {} // NEW

async function signUp(email, password) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip the verification email for the MVP
  });

  if (error) {
    if (error.code === 'email_exists' || error.code === 'user_already_exists') {
      throw new EmailTakenError('Email is already registered');
    }
    throw error;
  }

  return { id: data.user.id, email: data.user.email };
}

async function logIn(email, password) {
  const client = createPublicClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === 'invalid_credentials' || error.status === 400) {
      throw new InvalidCredentialsError('Invalid email or password');
    }
    throw error;
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    user: { id: data.user.id, email: data.user.email },
  };
}

async function logOut(accessToken) {
  const { error } = await supabase.auth.admin.signOut(accessToken, 'local');
  if (error) throw error;
}

module.exports = { signUp, logIn, logOut, EmailTakenError, InvalidCredentialsError };