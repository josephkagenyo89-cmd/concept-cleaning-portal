const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function run() {
  const name = 'assets';
  const { data, error } = await supabase.storage.createBucket(name, { public: true });
  if (error) {
    console.error('Error creating bucket:', error);
    process.exit(1);
  }

  console.log('Bucket created:', data);
}

run();
