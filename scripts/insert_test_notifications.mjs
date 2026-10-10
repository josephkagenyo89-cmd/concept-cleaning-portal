import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load .env (simple parser)
const envPath = new URL('../.env', import.meta.url);
let env = {};
try {
  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m) env[m[1]] = m[2];
  });
} catch (e) {
  console.error('Could not read .env:', e.message);
  process.exit(1);
}

const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function listAdminIds() {
  const { data, error } = await supabase.from('user_roles').select('user_id').in('role', ['admin', 'super_admin']);
  if (error) { console.error('listAdminIds error', error); return []; }
  return [...new Set((data || []).map(r => r.user_id).filter(Boolean))];
}

(async () => {
  try {
    let adminIds = await listAdminIds();
    console.log('Admin ids found:', adminIds.length);
    if (!adminIds.length) {
      console.log('No admins found — creating a test admin entry in `user_roles`.');
      const { randomUUID } = await import('crypto');
      const fakeId = randomUUID();
      const { error: rErr } = await supabase.from('user_roles').insert({ user_id: fakeId, role: 'admin' });
      if (rErr) {
        console.warn('Could not create test admin role:', rErr.message || rErr);
      } else {
        adminIds = [fakeId];
      }
    }

    const now = new Date().toISOString();
    const rows = [];
    rows.push(...adminIds.map(uid => ({
      user_id: uid,
      client_id: null,
      type: 'client',
      title: 'Test: New client registered',
      body: `A test client registered at ${now}`,
      link: '/admin/clients',
    })));
    rows.push(...adminIds.map(uid => ({
      user_id: uid,
      client_id: null,
      type: 'quotation',
      title: 'Test: New quotation created',
      body: `A test quotation was created at ${now}`,
      link: '/admin/quotations',
    })));
    rows.push(...adminIds.map(uid => ({
      user_id: uid,
      client_id: null,
      type: 'booking',
      title: 'Test: New booking saved',
      body: `A test booking was saved at ${now}`,
      link: '/admin/bookings',
    })));

    const { data, error } = await supabase.from('customer_notifications').insert(rows).select('*');
    if (error) throw error;
    console.log('Inserted notification rows:', data.length);

    const { data: recent } = await supabase.from('customer_notifications').select('*').order('created_at', { ascending: false }).limit(20);
    console.log('Recent notifications:');
    console.table(recent.map(r => ({ id: r.id, user_id: r.user_id, type: r.type, title: r.title, created_at: r.created_at })));

  } catch (e) {
    console.error('Failed:', e.message || e);
    process.exit(1);
  }
})();
