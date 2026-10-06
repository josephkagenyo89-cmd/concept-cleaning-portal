Title: Create Supabase `assets` storage bucket (public)

This document explains how to create a Supabase Storage bucket named `assets` and make it publicly readable. The admin UI in this project expects an `assets` bucket and uses public URLs like `/object/public/assets/...`.

Options provided:
- Supabase CLI (recommended)
- curl (using your `SERVICE_ROLE` key)
- Node script (included in `scripts/create_assets_bucket.js`)

1) Using the Supabase CLI (recommended)

Prerequisite: install the Supabase CLI and authenticate: https://supabase.com/docs/guides/cli

Run (from project root):

```bash
supabase storage create-bucket assets --public
```

If your CLI is scoped to a specific project, ensure you're connected to the right project (via `supabase login` and `supabase link` or `--project-ref`).

2) Using curl (service role key required)

Replace `SUPABASE_URL` and `SERVICE_ROLE_KEY` with your project's values.

```bash
curl -X POST "${SUPABASE_URL}/storage/v1/bucket" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"name":"assets","public":true}'
```

If successful the API returns JSON describing the created bucket.

3) Node script (included)

Install dependencies and run the script with environment variables. The script uses the Supabase Admin (service role) key and will create the bucket with public access.

```bash
# from project root
npm install @supabase/supabase-js
SUPABASE_URL=https://xyz.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/create_assets_bucket.js
```

4) Notes and follow-up
- Public access: creating the bucket with `public: true` makes uploaded objects publicly readable via Supabase's public URL endpoint. Ensure this matches your security needs.
- Filenames: this project stores category images under `categories/{slug}.jpg` in the `assets` bucket. The admin UI also lists all files.
- CORS & domain: you may optionally add CORS rules in Supabase dashboard under Storage → Settings → CORS if you restrict origins.
- Backups: consider storing original files elsewhere before replacing them if you need versioning.

If you want, I can:
- Run the Node script here (you must supply `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`), or
- Add the CLI command to a repo `Makefile` or npm script for convenience.
