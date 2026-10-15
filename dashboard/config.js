// Meet Focus Tracker - Teacher Dashboard Configuration (Role 4)
// Optional: You can paste your Supabase credentials here, OR enter them
// directly in the Teacher Login -> "Supabase Connection Settings" UI modal.

const CONFIG = {
  // Set to 'supabase' to query live database, or 'mock' for local offline testing
  BACKEND_PROVIDER: "supabase",

  // Supabase Project URL (e.g., "https://abcdefghijklmnopqrst.supabase.co")
  SUPABASE_URL: "",

  // Supabase Anon / Public Key (starts with "eyJhbGciOiJIUzI1Ni...")
  SUPABASE_ANON_KEY: ""
};

// Export to window for browser access
if (typeof window !== "undefined") {
  window.CONFIG = CONFIG;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = CONFIG;
}
