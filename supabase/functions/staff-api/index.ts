// Supabase Edge Function: staff-api
//
// The single door for every staff action on the website: entering and deleting records, uploading and removing documents,
// hiding the built-in documents, and starting the wildlife update. Each person signs in with their OWN account password
// (a Staff or Admin account made in Settings). After the check, the request is passed on to the function that does the
// work, using the shared staff secret that only this server knows. Every change is written to staff_actions.
//
// Calls (POST, JSON), every call carries { username, password, action, ... }:
//   check | sign | register | delete | entry-save | entry-delete   (passed on to upload-document)
//   hide | restore { id }                                          (built-in documents on the Documents page)
//   sync-wildlife                                                  (starts the iNaturalist and eBird update now)
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const FORWARD = new Set(['sign', 'register', 'delete', 'entry-save', 'entry-delete']);
const LOGGED = new Set(['register', 'delete', 'entry-save', 'entry-delete', 'hide', 'restore', 'sync-wildlife']);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Invalid request.' }, 400); }

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const shared = Deno.env.get('UPLOAD_PASSWORD');
  if (!shared) return json({ error: 'Staff tools are not set up yet.' }, 503);
  const supa = createClient(url, serviceKey, { auth: { persistSession: false } });

  const who = await supa.rpc('app_verify_staff', {
    p_username: typeof body.username === 'string' ? body.username.slice(0, 80) : '',
    p_password: typeof body.password === 'string' ? body.password.slice(0, 200) : '',
  });
  const v = who.data as { error?: string; username?: string; role?: string } | null;
  if (who.error || !v) return json({ error: 'Something went wrong. Please try again.' }, 500);
  if (v.error === 'too_many') return json({ error: 'Too many tries. Wait 15 minutes and try again.' }, 429);
  if (v.error === 'invalid') { await sleep(800); return json({ error: 'Wrong password.' }, 401); }
  if (v.error === 'not_staff') return json({ error: 'This account cannot use the staff tools.' }, 403);

  const action = String(body.action ?? '');
  const rest: Record<string, unknown> = { ...body };
  delete rest.username; delete rest.password;
  const log = async (detail: Record<string, unknown>) => {
    if (!LOGGED.has(action)) return;
    const { error } = await supa.from('staff_actions').insert({ username: v.username, action, detail: JSON.stringify(detail).slice(0, 500) });
    if (error) console.error(error);
  };

  try {
    if (action === 'check') return json({ ok: true, username: v.username, role: v.role });

    if (action === 'hide' || action === 'restore') {
      const id = String(body.id ?? '');
      if (!/^[a-z0-9-]{1,80}$/.test(id)) return json({ error: 'Unknown document.' }, 400);
      const { error } = action === 'hide' ? await supa.from('hidden_documents').upsert({ id }) : await supa.from('hidden_documents').delete().eq('id', id);
      if (error) throw error;
      await log({ id });
      return json({ ok: true });
    }

    if (action === 'sync-wildlife') {
      const res = await fetch(`${url}/functions/v1/species-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ password: shared }),
      });
      await log({});
      return new Response(await res.text(), { status: res.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    if (FORWARD.has(action)) {
      const res = await fetch(`${url}/functions/v1/upload-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ ...rest, password: shared }),
      });
      const text = await res.text();
      if (res.ok) await log({ form: rest.form, id: rest.id, title: rest.title, filename: rest.filename, date: rest.entry_date });
      return new Response(text, { status: res.status === 401 ? 500 : res.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    return json({ error: 'Unknown request.' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
