const { createClient } = require('@supabase/supabase-js');

// Server-only client. The service role key bypasses all database security rules,
// so this must NEVER be imported by the React app.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

module.exports = supabase;