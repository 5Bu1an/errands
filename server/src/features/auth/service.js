const supabase = require('../../lib/supabase');

class EmailTakenError extends Error {}

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

module.exports = { signUp, EmailTakenError };