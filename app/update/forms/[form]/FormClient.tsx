'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { callUploadFunction } from '@/app/documents/UploadPanel';
import { fetchEntries, type FormEntry } from '@/app/lib/entries';
import { FORMS_START_DATE, getFormSpec, validateEntry, type Field } from '@/app/lib/formSpec';
import { getStaffPassword, lockStaff } from '@/app/lib/staffAuth';
import { useDashboardData } from '@/app/lib/useDashboardData';
import type { LoadedDashboard } from '@/app/lib/dashboardData';

const rwandaToday = () => new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);

/** Values already on the dashboard, offered as suggestions so spelling stays consistent. */
function suggestionsFrom(d: LoadedDashboard | null): Record<string, string[]> {
  if (!d) return {};
  const top = (xs: (string | null | undefined)[]) => {
    const count = new Map<string, number>();
    for (const x of xs) { const v = x?.trim(); if (v) count.set(v, (count.get(v) ?? 0) + 1); }
    return Array.from(count.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v).slice(0, 60);
  };
  return {
    schools: top(d.schools.individualVisits.map(v => v.school)),
    programmes: top(d.schools.individualVisits.map(v => v.programme)),
    participantGroups: top(d.community.map(c => c.participantGroup)),
    passGroups: top(d.passes.detail.map(p => p.group).filter(g => !/^Complimentary participants in /.test(g) && g.length <= 120)),
    institutions: top([...d.research.map(r => r.institution), ...d.internshipPipeline.institutions.map(i => i.name)]),
    periods: top(d.internshipPipeline.requestedPeriod.map(p => p.period)),
    activities: top(d.research.map(r => r.requestedActivities).filter(a => (a?.length ?? 0) <= 60)),
    stakeholders: top(d.conflicts.map(c => c.stakeholder)),
    areaTypes: top(d.conflicts.map(c => c.areaType)),
    categories: top(d.conflicts.map(c => c.category)),
    issueTypes: top(d.conflicts.map(c => c.issueType)),
    affectedAreas: top(d.conflicts.map(c => c.affectedArea)),
    actionTypes: top(d.conflicts.map(c => c.actionType)),
  };
}

function blankValues(fields: Field[]): Record<string, string> {
  return Object.fromEntries(fields.map(f => [f.key, f.initial ?? '']));
}

function FieldInput({ f, value, onChange, options, disabled }: { f: Field; value: string; onChange: (v: string) => void; options: string[]; disabled: boolean }) {
  const common = { id: `f-${f.key}`, name: `entry-${f.key}`, autoComplete: 'off', disabled, value, onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement>) => onChange(e.target.value) };
  if (f.type === 'select') {
    return (
      <select {...common} className="species-search doc-upload-field">
        <option value="">Choose…</option>
        {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (f.type === 'longtext') return <textarea {...common} rows={3} maxLength={f.max} className="species-search doc-upload-field entry-textarea" />;
  if (f.type === 'date') return <input {...common} type="date" min={FORMS_START_DATE} className="species-search doc-upload-field" />;
  if (f.type === 'int' || f.type === 'decimal') return <input {...common} type="text" inputMode={f.type === 'int' ? 'numeric' : 'decimal'} className="species-search doc-upload-field" />;
  return (
    <>
      <input {...common} type="text" maxLength={f.max} list={f.suggest ? `dl-${f.key}` : undefined} className="species-search doc-upload-field" />
      {f.suggest && <datalist id={`dl-${f.key}`}>{options.map(o => <option key={o} value={o} />)}</datalist>}
    </>
  );
}

export default function FormClient({ formId }: { formId: string }) {
  const spec = getFormSpec(formId)!;
  const { data } = useDashboardData();
  const suggestions = useMemo(() => suggestionsFrom(data), [data]);

  const [date, setDate] = useState(() => { const t = rwandaToday(); return t < FORMS_START_DATE ? FORMS_START_DATE : t; });
  const [values, setValues] = useState<Record<string, string>>(() => blankValues(spec.fields));
  const [editing, setEditing] = useState<string | null>(null);
  const [entries, setEntries] = useState<FormEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [ok, setOk] = useState('');

  const refresh = useCallback(() => {
    fetchEntries(formId).then(setEntries).catch(() => setEntries([]));
  }, [formId]);
  useEffect(() => { refresh(); }, [refresh]);

  function reset() {
    setEditing(null);
    setValues(blankValues(spec.fields));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setOk('');
    const check = validateEntry(formId, date, values, { today: rwandaToday() });
    if (check.errors.length) return setErrors(check.errors);
    const password = getStaffPassword();
    if (!password) return lockStaff();
    setBusy(true); setErrors([]);
    try {
      await callUploadFunction({ action: 'entry-save', password, form: formId, id: editing ?? undefined, entry_date: check.clean!.entry_date, data: check.clean!.data });
      setOk(editing ? 'Entry updated. The dashboard shows it within a minute.' : 'Saved. The dashboard shows it within a minute.');
      reset();
      refresh();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  /** A wrong or changed password sends the user back to the sign-in box. */
  function handleError(err: unknown) {
    const message = err instanceof Error ? err.message : 'Something went wrong.';
    if (message === 'Wrong password.') return lockStaff();
    setErrors([message]);
  }

  async function remove(entry: FormEntry) {
    const password = getStaffPassword();
    if (!password) return lockStaff();
    if (!window.confirm('Delete this entry? The dashboard will stop counting it.')) return;
    setBusy(true); setErrors([]); setOk('');
    try {
      await callUploadFunction({ action: 'entry-delete', password, id: entry.id });
      if (editing === entry.id) reset();
      setOk('Entry deleted.');
      refresh();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  function edit(entry: FormEntry) {
    setOk(''); setErrors([]);
    setEditing(entry.id);
    setDate(entry.entry_date);
    setValues({ ...blankValues(spec.fields), ...Object.fromEntries(Object.entries(entry.data).map(([k, v]) => [k, String(v)])) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const label = (key: string) => spec.fields.find(f => f.key === key)?.label ?? key;

  return (
    <div className="report-page">
      <p className="doc-upload-help" style={{ marginBottom: 8 }}><Link href="/update" className="dash-report-link">← Staff data tools</Link></p>
      <h1 className="heading" style={{ margin: '0 0 6px' }}>{spec.title}</h1>
      <p className="doc-upload-help" style={{ marginBottom: spec.note ? 4 : '1.25rem', maxWidth: 720 }}>{spec.blurb}</p>
      {spec.note && <p className="doc-upload-help" style={{ marginBottom: '1.25rem', maxWidth: 720 }}>{spec.note}</p>}

      <form className="glass-card doc-upload-panel entry-form" onSubmit={submit} noValidate>
        {editing && <p className="doc-upload-ok">Editing an entry. Save to update it, or cancel to start a new one.</p>}
        <div className="entry-grid">
          <label className="doc-upload-label" htmlFor="f-date">
            {spec.dateLabel} *
            <input id="f-date" type="date" min={FORMS_START_DATE} max={rwandaToday()} value={date} disabled={busy} onChange={e => setDate(e.target.value)} className="species-search doc-upload-field" />
          </label>
          {spec.fields.map(f => (
            <label key={f.key} className={`doc-upload-label${f.type === 'longtext' ? ' entry-wide' : ''}`} htmlFor={`f-${f.key}`}>
              {f.label}{f.required ? ' *' : ''}
              <FieldInput f={f} value={values[f.key] ?? ''} onChange={v => setValues(s => ({ ...s, [f.key]: v }))} options={f.suggest ? suggestions[f.suggest] ?? [] : []} disabled={busy} />
              {f.help && <span className="doc-upload-meta">{f.help}</span>}
            </label>
          ))}
        </div>

        {errors.length > 0 && <div role="alert">{errors.map((m, i) => <p key={i} className="doc-upload-error">{m}</p>)}</div>}
        {ok && <p className="doc-upload-ok">{ok}</p>}

        <div className="doc-library-card-actions">
          <button type="submit" className="doc-action-btn doc-action-btn--primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Update entry' : 'Save entry'}</button>
          {editing && <button type="button" className="doc-action-btn doc-action-btn--ghost" disabled={busy} onClick={() => { reset(); setErrors([]); }}>Cancel edit</button>}
        </div>
      </form>

      <h2 className="doc-upload-title" style={{ margin: '1.5rem 0 8px' }}>Entries saved from this form</h2>
      {entries === null ? (
        <p className="doc-upload-help">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="doc-upload-help">No entries yet.</p>
      ) : (
        <table className="report-table entry-table">
          <thead>
            <tr>
              <th>{spec.dateLabel}</th>
              {spec.listKeys.map(k => <th key={k}>{label(k)}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.slice(0, 50).map(en => (
              <tr key={en.id}>
                <td>{en.entry_date}</td>
                {spec.listKeys.map(k => <td key={k}>{en.data[k] ?? ''}</td>)}
                <td>
                  <button type="button" className="entry-link" disabled={busy} onClick={() => edit(en)}>Edit</button>
                  {' · '}
                  <button type="button" className="entry-link" disabled={busy} onClick={() => remove(en)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
