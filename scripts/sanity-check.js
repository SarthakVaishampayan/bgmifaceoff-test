#!/usr/bin/env node

/**
 * BGFS (Battlegrounds Faceoff Series) — Sanity Check Script
 * 
 * Run this BEFORE deploying to verify the system, database connection,
 * environment variables, and essential routes are healthy.
 *
 * Usage:
 *   node scripts/sanity-check.js
 *   node scripts/sanity-check.js --server=http://localhost:3000
 */

const path = require('path');
const fs = require('fs');

// Load environment variables (.env.production or .env.local)
const ROOT = path.resolve(__dirname, '..');
const envProdPath = path.join(ROOT, '.env.production');
const envLocalPath = path.join(ROOT, '.env.local');

const envFile = fs.existsSync(envProdPath) ? envProdPath : envLocalPath;
if (fs.existsSync(envFile)) {
  const content = fs.readFileSync(envFile, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
}

const SERVER_URL = process.argv.find(a => a.startsWith('--server='))?.split('=')[1] || 'http://localhost:3000';

let passed = 0;
let failed = 0;
let warnings = 0;

const color = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

const log = (msg) => process.stdout.write(msg);

const header = (msg) => {
  console.log(`\n${color.cyan}════════════════════════════════════════════${color.reset}`);
  console.log(`${color.cyan}  ${msg}${color.reset}`);
  console.log(`${color.cyan}════════════════════════════════════════════${color.reset}\n`);
};

const testPass = (msg, detail = '') => {
  passed++;
  log(`${color.green}  ✓${color.reset} ${msg}${detail ? ` — ${color.dim}${detail}${color.reset}` : ''}\n`);
};

const testFail = (msg, detail = '') => {
  failed++;
  log(`${color.red}  ✗${color.reset} ${msg}${detail ? ` — ${color.dim}${detail}${color.reset}` : ''}\n`);
};

const testWarn = (msg, detail = '') => {
  warnings++;
  log(`${color.yellow}  ⚠${color.reset} ${msg}${detail ? ` — ${color.dim}${detail}${color.reset}` : ''}\n`);
};

const fetchUrl = async (url, options = {}) => {
  const resp = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(5000),
  });
  return { status: resp.status, headers: resp.headers };
};

(async () => {
  console.log(`${color.cyan}
  ╔══════════════════════════════════════════╗
  ║       BGFS Next.js — Sanity Check        ║
  ╚══════════════════════════════════════════╝${color.reset}`);
  console.log(`  Server:  ${SERVER_URL}`);
  console.log(`  Node:    ${process.version}`);
  console.log(`  Time:    ${new Date().toISOString()}\n`);

  // ─── 1. Environment Variables ───
  header('1. Environment Variables');
  const checkEnv = (name, required = true) => {
    const val = process.env[name];
    if (val && val.length > 0 && !val.includes('placeholder')) {
      testPass(`Env: ${name}`, `${val.slice(0, 8)}...`);
    } else if (required) {
      testFail(`Env: ${name}`, 'missing or placeholder');
    } else {
      testWarn(`Env: ${name}`, 'optional not set');
    }
  };

  checkEnv('NEXT_PUBLIC_SUPABASE_URL', true);
  checkEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', true);
  checkEnv('SUPABASE_SERVICE_ROLE_KEY', true);
  checkEnv('RAZORPAY_KEY_ID', true);
  checkEnv('RAZORPAY_KEY_SECRET', true);
  checkEnv('RAZORPAY_WEBHOOK_SECRET', false);

  // ─── 2. Supabase Live Connectivity ───
  header('2. Supabase Cloud Connection');
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supaUrl && supaKey) {
    try {
      const start = Date.now();
      const res = await fetch(`${supaUrl}/rest/v1/config?select=key&limit=1`, {
        headers: { 'apikey': supaKey, 'Authorization': `Bearer ${supaKey}` },
        signal: AbortSignal.timeout(4000),
      });
      const ms = Date.now() - start;
      if (res.ok) {
        testPass('Supabase REST ping', `${ms}ms round-trip`);
      } else {
        testFail('Supabase REST ping', `HTTP ${res.status}`);
      }
    } catch (err) {
      testFail('Supabase REST ping', `Connection failed: ${err.message}`);
    }
  } else {
    testWarn('Supabase ping skipped', 'Missing URL or key');
  }

  // ─── 3. Project Structure Integrity ───
  header('3. Project Structure');
  const requiredFiles = [
    'package.json',
    'next.config.ts',
    'middleware.ts',
    'app/layout.tsx',
    'app/page.tsx',
    'app/slots/page.tsx',
    'app/leaderboard/page.tsx',
    'app/dashboard/page.tsx',
    'lib/supabase/client.ts',
    'lib/supabase/server.ts',
    'lib/supabase/middleware.ts',
    'ecosystem.config.cjs',
  ];

  for (const file of requiredFiles) {
    if (fs.existsSync(path.join(ROOT, file))) {
      testPass(`File exists: ${file}`);
    } else {
      testFail(`Missing file: ${file}`);
    }
  }

  // ─── 4. Live Server Endpoints (if server is up) ───
  header('4. Local Server Endpoints');
  try {
    const { status } = await fetchUrl(`${SERVER_URL}/`);
    if (status === 200) {
      testPass('Homepage (/)', `status=${status}`);
    } else {
      testFail('Homepage (/)', `status=${status}`);
    }

    const pages = ['/about', '/pricing', '/privacy-policy', '/terms'];
    for (const p of pages) {
      try {
        const res = await fetchUrl(`${SERVER_URL}${p}`);
        if (res.status === 200) {
          testPass(`Page ${p}`, `status=${res.status}`);
        } else {
          testWarn(`Page ${p}`, `status=${res.status}`);
        }
      } catch (err) {
        testWarn(`Page ${p}`, err.message);
      }
    }
  } catch (err) {
    testWarn('Local server not running on port 3000', 'Endpoints skipped during build phase');
  }

  // ─── Summary ───
  header('Results');
  console.log(`  ${color.green}Passed:   ${passed}${color.reset}`);
  console.log(`  ${color.red}Failed:   ${failed}${color.reset}`);
  console.log(`  ${color.yellow}Warnings: ${warnings}${color.reset}`);
  console.log(`  Total:    ${passed + failed + warnings}\n`);

  if (failed > 0) {
    console.log(`  ${color.red}✗ Sanity checks failed. Please fix before deploying.${color.reset}\n`);
    process.exit(1);
  } else {
    console.log(`  ${color.green}✓ All critical sanity checks passed!${color.reset}\n`);
    process.exit(0);
  }
})();
