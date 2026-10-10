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
    console.log('Creating test client...');
    const cl = await supabase.from('clients').insert({
      full_name: `Test User ${Date.now()}`,
      phone: `0712${String(Math.floor(Math.random()*900000)+100000)}`,
      whatsapp_number: null,
      location: 'Test location',
      status: 'new',
      created_by: null,
      created_by_role: 'system',
    }).select('*').single();

    if (cl.error) throw cl.error;
    const client = cl.data;
    console.log('Client created id=', client.id);

    console.log('Generating quotation number...');
    const { data: num } = await supabase.rpc('next_quotation_number');
    const qn = (num) || `QT-${Date.now()}`;
    console.log('Quotation num:', qn);

    console.log('Creating quotation...');
    const q = await supabase.from('quotations').insert({
      quotation_number: qn,
      client_id: client.id,
      client_name: client.full_name,
      client_phone: client.phone,
      service_name: 'Test Service',
      service_date: null,
      price: 1234,
      created_by: null,
      created_by_name: 'system',
      created_by_role: 'system',
      line_items: [{ name: 'Test Service', quantity: 1, total: 1234 }]
    }).select('*').single();
    if (q.error) throw q.error;
    const quotation = q.data;
    console.log('Quotation created id=', quotation.id);

    console.log('Creating booking...');
    const b = await supabase.from('bookings').insert({
      agent_id: null,
      client_id: client.id,
      client_name: client.full_name,
      client_phone: client.phone,
      location: client.location,
      service_id: null,
      service_date: null,
      preferred_time: null,
      price: 1234,
      system_price: 1234,
      status: 'pending',
      created_by_name: 'system',
      created_by_role: 'system',
      line_items: [{ serviceName: 'Test Service', total: 1234 }]
    }).select('*').single();
    if (b.error) throw b.error;
    const booking = b.data;
    console.log('Booking created id=', booking.id);

    // Notify admins: insert into customer_notifications
    const adminIds = await listAdminIds();
    console.log('Admin ids:', adminIds.length);
    if (adminIds.length) {
      const rows = adminIds.map(uid => ({
        user_id: uid,
        client_id: client.id,
        type: 'test',
        title: 'Automated test notification',
        body: `Test entries created: client ${client.id}, quotation ${quotation.id}, booking ${booking.id}`,
        link: '/admin/bookings'
      }));
      const { data: notif, error: notifErr } = await supabase.from('customer_notifications').insert(rows).select('*');
      if (notifErr) console.warn('Could not insert notifications:', notifErr);
      else console.log('Inserted notifications:', notif.length);
    } else {
      console.log('No admin users found — skipped notification insert.');
    }

    console.log('Fetching recent notifications...');
    const { data: recent } = await supabase.from('customer_notifications').select('*').order('created_at', { ascending: false }).limit(10);
    console.log('Recent notifications:', recent || []);

  } catch (e) {
    console.error('Test failed:', e.message || e);
    process.exit(1);
  }
})();
