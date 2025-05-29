#!/usr/bin/env node

/**
 * Environment Switcher for Paperless Maverick
 *
 * Usage:
 *   node scripts/switch-env.js local     # Switch to local development
 *   node scripts/switch-env.js production # Switch to production
 *   node scripts/switch-env.js status    # Show current environment
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENV_FILE = path.join(__dirname, '..', '.env.local');

const ENVIRONMENTS = {
  local: {
    url: 'http://127.0.0.1:54331',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
    description: 'Local Supabase (empty database, create test users)'
  },
  production: {
    url: 'https://mpmkbtsufihzdelrlszs.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY',
    description: 'Production Supabase (real data, existing users)'
  }
};

function getCurrentEnvironment() {
  try {
    const content = fs.readFileSync(ENV_FILE, 'utf8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('VITE_SUPABASE_URL=') && !line.startsWith('#')) {
        const url = line.split('=')[1];
        if (url.includes('127.0.0.1')) return 'local';
        if (url.includes('supabase.co')) return 'production';
      }
    }
    return 'unknown';
  } catch (error) {
    console.error('Error reading .env.local:', error.message);
    return 'error';
  }
}

function switchEnvironment(target) {
  try {
    let content = fs.readFileSync(ENV_FILE, 'utf8');
    const lines = content.split('\n');

    const targetEnv = ENVIRONMENTS[target];

    // Find and update the environment variables
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Handle VITE_SUPABASE_URL
      if (line.includes('VITE_SUPABASE_URL=') && !line.includes('_PRODUCTION') && !line.includes('_LOCAL')) {
        if (target === 'production') {
          lines[i] = `VITE_SUPABASE_URL=${targetEnv.url}`;
        } else {
          lines[i] = `# VITE_SUPABASE_URL=${ENVIRONMENTS.production.url}`;
        }
      }

      // Handle VITE_SUPABASE_ANON_KEY
      if (line.includes('VITE_SUPABASE_ANON_KEY=') && !line.includes('_PRODUCTION') && !line.includes('_LOCAL')) {
        if (target === 'production') {
          lines[i] = `VITE_SUPABASE_ANON_KEY=${targetEnv.key}`;
        } else {
          lines[i] = `# VITE_SUPABASE_ANON_KEY=${ENVIRONMENTS.production.key}`;
        }
      }

      // Handle commented local environment variables
      if (line.includes('# VITE_SUPABASE_URL=http://127.0.0.1:54331')) {
        if (target === 'local') {
          lines[i] = `VITE_SUPABASE_URL=${targetEnv.url}`;
        } else {
          lines[i] = `# VITE_SUPABASE_URL=${targetEnv.url}`;
        }
      }

      if (line.includes('# VITE_SUPABASE_ANON_KEY=') && line.includes('supabase-demo')) {
        if (target === 'local') {
          lines[i] = `VITE_SUPABASE_ANON_KEY=${targetEnv.key}`;
        } else {
          lines[i] = `# VITE_SUPABASE_ANON_KEY=${targetEnv.key}`;
        }
      }
    }

    fs.writeFileSync(ENV_FILE, lines.join('\n'));

    console.log(`✅ Switched to ${target} environment`);
    console.log(`📍 ${targetEnv.description}`);
    console.log(`🔗 URL: ${targetEnv.url}`);
    console.log(`\n⚠️  Please restart your development server for changes to take effect:`);
    console.log(`   npm run dev`);

  } catch (error) {
    console.error('❌ Error switching environment:', error.message);
  }
}

function showStatus() {
  const current = getCurrentEnvironment();
  console.log(`\n📊 Current Environment: ${current.toUpperCase()}`);
  
  if (ENVIRONMENTS[current]) {
    console.log(`📍 ${ENVIRONMENTS[current].description}`);
    console.log(`🔗 URL: ${ENVIRONMENTS[current].url}`);
  }
  
  console.log(`\n🔄 Available commands:`);
  console.log(`   node scripts/switch-env.js local      # Switch to local development`);
  console.log(`   node scripts/switch-env.js production # Switch to production`);
  console.log(`   node scripts/switch-env.js status     # Show this status`);
}

// Main execution
const command = process.argv[2];

if (!command || command === 'status') {
  showStatus();
} else if (ENVIRONMENTS[command]) {
  switchEnvironment(command);
} else {
  console.error(`❌ Unknown environment: ${command}`);
  console.log(`Available environments: ${Object.keys(ENVIRONMENTS).join(', ')}`);
  process.exit(1);
}
