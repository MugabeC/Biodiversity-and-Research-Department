// Supabase Edge Function: hide-document
//
// The older documents on the Documents page are files built into the website, so they cannot be deleted from the
// database. This function lets staff hide one from the page (and bring it back). It needs the same staff password
// (secret UPLOAD_PASSWORD) as the other staff tools.
//
// Calls (POST, JSON), every call carries { password }:
//   { action: 'hide', id }     -> { ok: true }   (the document no longer shows on the Documents page)
//   { action: 'restore', id }  -> { ok: true }   (it shows again)
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function same(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const A = new Uint8Array(x), B = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < A.length; i++) diff |= A[i] ^ B[i];
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Invalid request.' }, 400); }

  const expected = Deno.env.get('UPLOAD_PASSWORD');
  if (!expected) return json({ error: 'Staff tools are not set up yet.' }, 503);
  if (typeof body.password !== 'string' || !(await same(body.password, expected))) {
    await sleep(1000);
    return json({ error: 'Wrong password.' }, 401);
  }
  const id = String(body.id ?? '');
  if (!/^[a-z0-9-]{1,80}$/.test(id)) return json({ error: 'Unknown document.' }, 400);

  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  try {
    if (body.action === 'hide') {
      const { error } = await supa.from('hidden_documents').upsert({ id });
      if (error) throw error;
      return json({ ok: true });
    }
    if (body.action === 'restore') {
      const { error } = await supa.from('hidden_documents').delete().eq('id', id);
      if (error) throw error;
      return json({ ok: true });
    }
    return json({ error: 'Unknown request.' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
