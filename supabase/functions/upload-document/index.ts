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
//   { action: 'entry-save', form, entry_date, data, id? } -> { entry }                   (adds or changes one record from a staff form)
//   { action: 'entry-delete', id }                        -> { ok: true }                (removes a record; it is kept, marked deleted)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { validateEntry } from './formSpec.ts';

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

      case 'entry-save': {
        const form = String(body.form ?? '');
        const today = new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10); // Rwanda date
        const checked = validateEntry(form, body.entry_date, body.data, { today });
        if (!checked.clean) return json({ error: checked.errors.join(' ') }, 400);
        const id = body.id === undefined || body.id === null ? '' : String(body.id);
        const d = checked.clean.data;
        if (form === 'survival-check') {
          const { data: planting, error: pe } = await supa.from('form_entries').select('entry_date, data')
            .eq('id', String(d.planting_id)).eq('form', 'planting').is('deleted_at', null).maybeSingle();
          if (pe) throw pe;
          if (!planting) return json({ error: 'Choose a planting from the list.' }, 400);
          const planted = Number(planting.data?.trees_planted ?? 0);
          const total = Number(d.alive ?? 0) + Number(d.dead ?? 0);
          if (total > planted) return json({ error: `Alive and dead add up to ${total}, but ${planted} trees were planted.` }, 400);
          if (checked.clean.entry_date < planting.entry_date) return json({ error: 'The check cannot be before the planting date.' }, 400);
          let dup = supa.from('form_entries').select('id').eq('form', 'survival-check').is('deleted_at', null)
            .eq('data->>planting_id', String(d.planting_id)).eq('data->>checkpoint', String(d.checkpoint));
          if (id) dup = dup.neq('id', id);
          const { data: existing, error: de } = await dup.limit(1);
          if (de) throw de;
          if (existing?.length) return json({ error: 'This checkpoint is already recorded for that planting. Edit the existing entry.' }, 400);
        }
        if (form === 'planting' && id) {
          const { data: checks, error: ce } = await supa.from('form_entries').select('data').eq('form', 'survival-check').is('deleted_at', null).eq('data->>planting_id', id);
          if (ce) throw ce;
          const most = Math.max(0, ...(checks ?? []).map(c => Number(c.data?.alive ?? 0) + Number(c.data?.dead ?? 0)));
          if (most > Number(d.trees_planted ?? 0)) return json({ error: `A survival check already counts ${most} trees. Trees planted cannot be lower.` }, 400);
        }
        if (id) {
          const { data, error } = await supa.from('form_entries')
            .update({ entry_date: checked.clean.entry_date, data: checked.clean.data, updated_at: new Date().toISOString() })
            .eq('id', id).eq('form', form).is('deleted_at', null).select().maybeSingle();
          if (error) throw error;
          if (!data) return json({ error: 'That entry no longer exists.' }, 404);
          return json({ entry: data });
        }
        const { data, error } = await supa.from('form_entries')
          .insert({ form, entry_date: checked.clean.entry_date, data: checked.clean.data }).select().single();
        if (error) throw error;
        return json({ entry: data });
      }

      case 'entry-delete': {
        const id = String(body.id ?? '');
        if (!id) return json({ error: 'Missing entry.' }, 400);
        const { data: found, error: fe } = await supa.from('form_entries').select('id, form').eq('id', id).is('deleted_at', null).maybeSingle();
        if (fe) throw fe;
        if (!found) return json({ error: 'That entry no longer exists.' }, 404);
        if (found.form === 'planting') {
          const { data: used, error: ue } = await supa.from('form_entries').select('id').eq('form', 'survival-check').is('deleted_at', null).eq('data->>planting_id', id).limit(1);
          if (ue) throw ue;
          if (used?.length) return json({ error: 'Delete the survival checks of this planting first.' }, 400);
        }
        const { data, error } = await supa.from('form_entries').update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null).select('id').maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: 'That entry no longer exists.' }, 404);
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
