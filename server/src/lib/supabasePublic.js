const { createClient } = require('@supabase/supabase-js');

// Makes a FRESH client for each login request.
// signInWithPassword stores the logged-in session inside the client object,
// so one shared client would mix up different users' sessions.
function createPublicClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

module.exports = { createPublicClient };