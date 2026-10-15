/**
 * Meet Focus Tracker - Configuration Template
 * 
 * Instructions:
 * 1. Copy this file and save it as "config.js" in the extension folder.
 * 2. Replace the placeholder values with your Supabase Project URL and Anon Public Key.
 * 3. Never commit your production secrets or service_role key to public Git repositories.
 */

const SUPABASE_CONFIG = {
  // Your Supabase Project URL (e.g., "https://xyzcompany.supabase.co")
  url: 'https://YOUR_PROJECT_ID.supabase.co',

  // Your Supabase public anonymous API key (found in Project Settings -> API)
  anonKey: 'YOUR_SUPABASE_ANON_KEY'
};

// Expose to ServiceWorkerGlobalScope and Window context
if (typeof self !== 'undefined') {
  self.SUPABASE_CONFIG = SUPABASE_CONFIG;
}
if (typeof window !== 'undefined') {
  window.SUPABASE_CONFIG = SUPABASE_CONFIG;
}
