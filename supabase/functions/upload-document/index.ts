// Supabase Edge Function: upload-document
//
// Lets staff add and remove documents on the website's Documents page.
// Everything is protected by one shared password (secret UPLOAD_PASSWORD, set in the Supabase dashboard).
// The browser never receives a Supabase secret key: it only gets a one-time signed upload link.
//
// Calls (POST, JSON), every call carries { password }:
//   { action: 'check' }                                   -> { ok: true }
//   { action: 'sign', filename, size }                    -> { path, token, signedUrl }  (then the browser uploads the file to signedUrl)
//   { action: 'register', path, filename, title, description } -> { document }          (adds it to the Documents page)
//   { action: 'delete', id }                              -> { ok: true }                (removes the file and its list entry)
import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKET = 'Biodiversity and Research Department';
const MAX_BYTES = 25 * 1024 * 1024;
const TYPES: Record<string, string> = { pdf: 'pdf', doc: 'word', docx: 'word', xls: 'excel', xlsx: 'excel', ppt: 'powerpoint', pptx: 'powerpoint' };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const getPassword = (): string | undefined => Deno.env.get('UPLOAD_PASSWORD');

/** Compare two strings without leaking where they differ. */
async function same(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const A = new Uint8Array(x), B = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < A.length; i++) diff |= A[i] ^ B[i];
  return diff === 0;
}

function safeName(name: string): string {
  const s = name.normalize('NFKD').replace(/[^\w.\- ]+/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
  return s.slice(-80) || 'file';
}
const extOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Invalid request.' }, 400); }

  const expected = getPassword();
  if (!expected) return json({ error: 'Uploads are not set up yet.' }, 503);
  if (typeof body.password !== 'string' || !(await same(body.password, expected))) {
    await sleep(1000); // slows down password guessing
    return json({ error: 'Wrong password.' }, 401);
  }

  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  try {
    switch (body.action) {
      case 'check':
        return json({ ok: true });

      case 'sign': {
        const name = String(body.filename ?? '');
        if (!TYPES[extOf(name)]) return json({ error: 'Allowed file types: PDF, Word, Excel and PowerPoint.' }, 400);
        const size = Number(body.size);
        if (!(size > 0)) return json({ error: 'The file looks empty.' }, 400);
        if (size > MAX_BYTES) return json({ error: 'The file is larger than 25 MB.' }, 400);
        const path = `library/${Date.now()}-${safeName(name)}`;
        const { data, error } = await supa.storage.from(BUCKET).createSignedUploadUrl(path);
        if (error) throw error;
        return json({ path: data.path, token: data.token, signedUrl: data.signedUrl });
      }

      case 'register': {
        const path = String(body.path ?? '');
        if (!/^library\/[^/]+$/.test(path) || !TYPES[extOf(path)]) return json({ error: 'Invalid file.' }, 400);
        const title = String(body.title ?? '').trim().slice(0, 200);
        if (!title) return json({ error: 'Please add a title.' }, 400);
        const description = String(body.description ?? '').trim().slice(0, 600);
        const file = path.slice('library/'.length);
        const { data: found, error: listError } = await supa.storage.from(BUCKET).list('library', { search: file, limit: 10 });
        if (listError) throw listError;
        const obj = found?.find(o => o.name === file);
        if (!obj) return json({ error: 'The file did not arrive. Please try the upload again.' }, 400);
        const { data, error } = await supa.from('library_documents').insert({
          title,
          description: description || null,
          filename: String(body.filename ?? file).slice(0, 200),
          storage_path: path,
          file_type: TYPES[extOf(path)],
          size_bytes: Number(obj.metadata?.size ?? 0) || null,
        }).select().single();
        if (error) throw error;
        return json({ document: data });
      }

      case 'delete': {
        const id = String(body.id ?? '');
        const { data: row, error: findError } = await supa.from('library_documents').select('id, storage_path').eq('id', id).maybeSingle();
        if (findError) throw findError;
        if (!row) return json({ error: 'Document not found.' }, 404);
        const { error: removeError } = await supa.storage.from(BUCKET).remove([row.storage_path]);
        if (removeError) throw removeError;
        const { error: deleteError } = await supa.from('library_documents').delete().eq('id', id);
        if (deleteError) throw deleteError;
        return json({ ok: true });
      }

      default:
        return json({ error: 'Unknown request.' }, 400);
    }
  } catch (e) {
    console.error(e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
