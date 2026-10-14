// Configuration example for Meet Focus Tracker Dashboard (Role 4)
// Copy this file to 'config.js' and replace with your project's credentials.
// IMPORTANT: Do NOT commit config.js with real API keys or URLs to GitHub.
// Ensure Role 1 includes 'dashboard/config.js' in .gitignore.

const CONFIG = {
  // Backend provider: 'supabase' | 'firebase' | 'mock'
  BACKEND_PROVIDER: "mock",

  // Supabase Configuration Example
  SUPABASE_URL: "https://your-project-id.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-anon-public-key",

  // Firebase Configuration Example (if Firebase is chosen by the team)
  FIREBASE_CONFIG: {
    apiKey: "AIzaSyYourApiKeyExamplePlaceholder",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890"
  }
};

// Export for browser script or module environments
if (typeof window !== "undefined") {
  window.CONFIG = CONFIG;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = CONFIG;
}
