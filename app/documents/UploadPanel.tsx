'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ACCEPTED_FILE_TYPES,
  MAX_UPLOAD_BYTES,
  SUPABASE_PUBLISHABLE_KEY,
  UPLOAD_FUNCTION_URL,
  formatFileSize,
} from '@/app/lib/documents';

export async function callUploadFunction(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(UPLOAD_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  let data: Record<string, unknown> = {};
  try { data = await res.json(); } catch { /* not JSON */ }
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Something went wrong. Please try again.');
  return data;
}

function sendFile(signedUrl: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('cacheControl', '3600');
    form.append('', file);
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('The file could not be uploaded. Please try again.')));
    xhr.onerror = () => reject(new Error('Network problem while uploading. Please try again.'));
    xhr.send(form);
  });
}

export default function UploadPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  function reset() {
    setTitle(''); setDescription(''); setFile(null); setProgress(0);
    if (fileInput.current) fileInput.current.value = '';
  }

  function pick(f: File | null) {
    setError(''); setDone('');
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setDone('');
    if (!file) return setError('Choose a file first.');
    if (file.size > MAX_UPLOAD_BYTES) return setError('The file is larger than 25 MB.');
    if (!title.trim()) return setError('Please add a title.');
    if (!password) return setError('Enter the upload password.');
    setBusy(true); setProgress(0);
    try {
      const signed = await callUploadFunction({ action: 'sign', password, filename: file.name, size: file.size });
      await sendFile(String(signed.signedUrl), file, setProgress);
      await callUploadFunction({ action: 'register', password, path: signed.path, filename: file.name, title: title.trim(), description: description.trim() });
      setDone(`“${title.trim()}” is now on the Documents page.`);
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="glass-card doc-upload-panel" onSubmit={submit}>
      <h2 className="heading doc-upload-title">Upload a document</h2>
      <p className="doc-upload-help">
        PDF, Word, Excel or PowerPoint, up to 25 MB. Anyone with the link can open an uploaded document.
      </p>

      <label className="doc-upload-label">
        File
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          disabled={busy}
          onChange={e => pick(e.target.files?.[0] ?? null)}
          className="doc-upload-input"
        />
      </label>
      {file && <p className="doc-upload-help">{file.name} · {formatFileSize(file.size)}</p>}

      <label className="doc-upload-label">
        Title
        <input className="species-search doc-upload-field" value={title} maxLength={200} disabled={busy} onChange={e => setTitle(e.target.value)} placeholder="e.g. Monthly report, October 2026" />
      </label>
      <label className="doc-upload-label">
        Short description (optional)
        <input className="species-search doc-upload-field" value={description} maxLength={600} disabled={busy} onChange={e => setDescription(e.target.value)} />
      </label>
      <label className="doc-upload-label">
        Upload password
        <input className="species-search doc-upload-field" type="password" autoComplete="off" value={password} disabled={busy} onChange={e => setPassword(e.target.value)} />
      </label>

      {busy && (
        <div className="doc-upload-progress" aria-label="Upload progress">
          <div style={{ width: `${progress}%` }} />
        </div>
      )}
      {error && <p className="doc-upload-error" role="alert">{error}</p>}
      {done && <p className="doc-upload-ok">{done}</p>}

      <div className="doc-library-card-actions">
        <button type="submit" className="doc-action-btn doc-action-btn--primary" disabled={busy}>
          {busy ? (progress < 100 ? `Uploading… ${progress}%` : 'Finishing…') : 'Upload'}
        </button>
        <button type="button" className="doc-action-btn doc-action-btn--ghost" disabled={busy} onClick={() => { onClose(); setError(''); }}>
          Close
        </button>
      </div>
    </form>
  );
}
