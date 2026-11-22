# Biodiversity and Research Department site

Public website for Nyandungu Eco-Park's Biodiversity and Research Department: dashboard, Species Explorer, Wildlife records, Map, Documents and a monthly summary. Staff add records through password-protected forms.

## How it is put together

| Part | What it does | Where |
| --- | --- | --- |
| Website | Next.js site, built and hosted by Vercel. Every change merged to `master` goes live automatically. | this repository |
| Database and files | Supabase project: staff entries (`form_entries`), wildlife records (`species_observations`), documents (`library_documents` and storage). | Supabase dashboard |
| `upload-document` function | Checks the staff password; saves, edits and deletes entries; handles document uploads. | `supabase/functions/upload-document` |
| `species-sync` function | Collects iNaturalist (and eBird) records inside the park boundary every night. | `supabase/functions/species-sync` |

## Passwords and keys (set in the Supabase dashboard, Edge Functions, Secrets)

- `UPLOAD_PASSWORD`: the staff password for the staff tools and document uploads. To change it, replace the secret.
- `EBIRD_API_KEY`: free key from https://ebird.org/api/keygen, used by the nightly wildlife update.

## Staff tools

`/update` (not linked from the menu, hidden from search engines). Forms exist for school visits, community activities, complimentary admissions, internship applications, research requests, conflict cases, waste, water tests, tree planting and survival checks. Wildlife records need no typing.

Every record on the dashboard that comes from staff (school visits, community activities, complimentary admissions, research requests, conflict cases, waste, water tests, tree planting and survival) is a staff entry you can search, edit or delete in the staff tools. Records from before the forms existed were moved in with `scripts/build_legacy_entries.ts`; their dates are the first of the month when only the month was known. `public/data/entries-snapshot.json` is a copy the site shows while the database loads or is out of reach.

The checks on every form live in `app/lib/formSpec.ts`. The server uses an identical copy in `supabase/functions/upload-document/formSpec.ts`. After changing the form definitions, copy the file over, run `scripts/check_form_spec.sh`, and redeploy the function.

## Working on the code

```bash
npm install
npm run dev          # http://localhost:3000
npm run lint
npx tsc --noEmit
npx tsx scripts/test_entries.ts   # checks the form rules and the dashboard totals
```

## If something goes wrong

- Site down or broken after a change: in Vercel, open Deployments and promote the previous deployment, then fix the code.
- Wildlife page empty: open `/update/wildlife` and press Update now.
- A wrong entry: edit or delete it in the staff tools (deleted entries are kept in the database, marked deleted).
