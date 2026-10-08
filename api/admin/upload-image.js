const { createClient } = require('@supabase/supabase-js');
const formidable = require('formidable');
const fs = require('fs');

export const config = {
  api: {
    bodyParser: false,
  },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method not allowed');

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server not configured with Supabase credentials' });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields, files) => {
    try {
      if (err) throw err;
      const file = files.file;
      const path = fields.path || file.name;
      const buffer = fs.readFileSync(file.path);

      const { data, error: upErr } = await supabase.storage.from('assets').upload(path, buffer, { upsert: true });
      if (upErr) throw upErr;

      res.status(200).json({ ok: true, data });
    } catch (e) {
      console.error('Upload error', e);
      res.status(500).json({ error: e.message || String(e) });
    }
  });
};
