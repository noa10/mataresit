const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://mpmkbtsufihzdelrlszs.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyFix() {
  try {
    const sql = fs.readFileSync('fix_unified_search_only.sql', 'utf8');
    
    console.log('Applying unified search RLS bypass fix...');
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('Error applying fix:', error);
      return;
    }
    
    console.log('Fix applied successfully!');
    console.log('Result:', data);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

applyFix();
