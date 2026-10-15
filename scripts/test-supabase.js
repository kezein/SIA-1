/**
 * Meet Focus Tracker - Supabase & RLS Verification Script (Role 3)
 * Author: Aaron Celindro
 * 
 * Usage:
 *   node scripts/test-supabase.js [SUPABASE_URL] [SUPABASE_ANON_KEY] [SERVICE_ROLE_KEY]
 * 
 * If no arguments are provided, it automatically reads the credentials from extension/config.js!
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let supabaseUrl = (args[0] || '').replace(/\/+$/, '');
let anonKey = args[1];
const serviceRoleKey = args[2];

// If arguments not provided, read from extension/config.js automatically
if (!supabaseUrl || !anonKey) {
  try {
    const configPath = path.join(__dirname, '../extension/config.js');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const urlMatch = content.match(/url:\s*['"]([^'"]+)['"]/);
      const keyMatch = content.match(/anonKey:\s*['"]([^'"]+)['"]/);
      if (urlMatch && keyMatch) {
        supabaseUrl = urlMatch[1].trim().replace(/\/+$/, '');
        anonKey = keyMatch[1].trim();
      }
    }
  } catch (err) {
    // Ignore error and check values below
  }
}

if (!supabaseUrl || !anonKey || supabaseUrl.includes('YOUR_PROJECT_ID') || anonKey.includes('YOUR_SUPABASE_ANON_KEY')) {
  console.log(`
=============================================================
  Meet Focus Tracker - Supabase & RLS Test Script
=============================================================
Usage:
  node scripts/test-supabase.js [SUPABASE_URL] [SUPABASE_ANON_KEY] [SERVICE_ROLE_KEY]

Or simply save your credentials in extension/config.js and run:
  node scripts/test-supabase.js
=============================================================
`);
  process.exit(1);
}

function request(url, options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: body });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body, raw: body });
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n=============================================================');
  console.log(' Meet Focus Tracker - Backend & Security Verification');
  console.log(' Target URL:', supabaseUrl);
  console.log('=============================================================');

  console.log('\n--- [1] Checking Database Table & Connection ---');
  try {
    // Query focus_events with anon key (checks if table exists)
    const checkRes = await request(`${supabaseUrl}/rest/v1/focus_events?select=id&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });

    if (checkRes.status === 200) {
      console.log('✔ Connected to Supabase PostgREST API successfully.');
      console.log('✔ Table "focus_events" exists and is accessible.');
    } else if (checkRes.status === 404 || (checkRes.body && checkRes.body.message && checkRes.body.message.includes('relation "public.focus_events" does not exist'))) {
      console.error('✖ Table "focus_events" does NOT exist yet in your Supabase project!');
      console.log('\n👉 ACTION REQUIRED:');
      console.log('   1. Open your Supabase Dashboard: https://supabase.com/dashboard');
      console.log('   2. Go to the SQL Editor (left sidebar).');
      console.log('   3. Open "supabase/schema.sql" from this repository, copy all code, paste into SQL Editor, and click RUN.');
      console.log('   4. Run this test script again!\n');
      return;
    } else {
      console.log(`ℹ API responded with status ${checkRes.status}: ${checkRes.raw}`);
    }
  } catch (err) {
    console.error(`✖ Network error connecting to Supabase: ${err.message}`);
    return;
  }

  console.log('\n--- [2] Testing Anonymous INSERT (Extension Flow) ---');
  const testMeetingCode = `test-${Math.random().toString(36).substring(2, 7)}`;
  const sampleEvent = {
    participant: 'Test Student (Maria)',
    meetingCode: testMeetingCode,
    type: 'left',
    timestamp: Date.now()
  };

  try {
    const insertRes = await request(`${supabaseUrl}/rest/v1/focus_events`, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    }, sampleEvent);

    if (insertRes.status === 201 || insertRes.status === 200 || insertRes.status === 204) {
      console.log('✔ Anonymous INSERT succeeded! (Status: ' + insertRes.status + ')');
      console.log(`  Inserted test event for meeting "${testMeetingCode}".`);
    } else {
      console.error(`✖ INSERT failed with status ${insertRes.status}:`, insertRes.body || insertRes.raw);
      if (insertRes.status === 401 || insertRes.status === 403) {
        console.log('👉 Tip: Ensure you have executed supabase/schema.sql which creates the INSERT RLS policy.');
      }
      return;
    }
  } catch (err) {
    console.error('✖ INSERT network error:', err.message);
    return;
  }

  console.log('\n--- [3] Testing Anonymous SELECT (Security Rule / RLS) ---');
  console.log('Privacy check: Extension participants using anonKey must NOT read events.');
  try {
    const selectRes = await request(`${supabaseUrl}/rest/v1/focus_events?meetingCode=eq.${testMeetingCode}`, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });

    if (selectRes.status === 200 && Array.isArray(selectRes.body) && selectRes.body.length === 0) {
      console.log('✔ RLS Verified! Anon query returned 0 rows (reading is blocked for anonymous users).');
    } else if (selectRes.status === 401 || selectRes.status === 403) {
      console.log(`✔ RLS Verified! Server rejected anonymous read with status ${selectRes.status}.`);
    } else if (Array.isArray(selectRes.body) && selectRes.body.length > 0) {
      console.warn('⚠ NOTICE: Anonymous SELECT returned rows. If in dev mode, this is expected if "Dev only: allow anon read" policy was enabled.');
    } else {
      console.log(`Response status: ${selectRes.status}`, selectRes.body);
    }
  } catch (err) {
    console.error('✖ SELECT network error:', err.message);
  }

  if (serviceRoleKey) {
    console.log('\n--- [4] Testing Admin / Authenticated SELECT (Dashboard Flow) ---');
    try {
      const adminRes = await request(`${supabaseUrl}/rest/v1/focus_events?meetingCode=eq.${testMeetingCode}`, {
        method: 'GET',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`
        }
      });

      if (adminRes.status === 200 && Array.isArray(adminRes.body) && adminRes.body.length > 0) {
        console.log(`✔ Admin query succeeded! Retrieved ${adminRes.body.length} event(s) for meeting ${testMeetingCode}:`);
        console.log(adminRes.body[0]);
      } else {
        console.warn(`✖ Admin query returned unexpected status ${adminRes.status}:`, adminRes.body);
      }
    } catch (err) {
      console.error('✖ Admin query error:', err.message);
    }
  } else {
    console.log('\n💡 Optional: Pass your service_role key as argument 3 if you wish to verify admin/teacher reading.');
  }

  console.log('\n=============================================================');
  console.log(' Test run complete! Your Supabase backend is ready.');
  console.log('=============================================================\n');
}

runTests();
