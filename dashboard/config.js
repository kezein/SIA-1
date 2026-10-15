// Meet Focus Tracker - Teacher Dashboard Configuration (Role 4)
// Optional: You can paste your Supabase credentials here, OR enter them
// directly in the Teacher Login -> "Supabase Connection Settings" UI modal.

const CONFIG = {
  // Set to 'supabase' to query live database, or 'mock' for local offline testing
  BACKEND_PROVIDER: "supabase",

  // Supabase Project URL (e.g., "https://abcdefghijklmnopqrst.supabase.co")
  SUPABASE_URL: "https://qiqpzshiutfekkzzniuf.supabase.co",

  // Supabase Anon / Public Key (starts with "eyJhbGciOiJIUzI1Ni...")
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpcXB6c2hpdXRmZWtrenpuaXVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NzE0MDcsImV4cCI6MjEwNzU0NzQwN30.Hr2BOT-63-8oyjjOGScuYL6flZwJNTZCyh1IzWo6sXU"
};

// Export to window for browser access
if (typeof window !== "undefined") {
  window.CONFIG = CONFIG;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = CONFIG;
}
