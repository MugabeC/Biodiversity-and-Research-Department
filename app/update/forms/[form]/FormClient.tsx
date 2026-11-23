'use client';

import Link from 'next/link';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { callUploadFunction } from '@/app/documents/UploadPanel';
import { fetchEntries, type FormEntry } from '@/app/lib/entries';
import { PLANT_SPECIES } from '@/app/lib/plantSpecies';
import { buildRestoration, checksDue } from '@/app/lib/restoration';
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
    waterPoints: top([...(d.bioWater?.samplingPoints ?? []), ...d.waterTests.map(t => t.point)]),
  };
}

function blankValues(fields: Field[]): Record<string, string> {
  return Object.fromEntries(fields.map(f => [f.key, f.initial ?? '']));
}

function FieldInput({ f, value, onChange, options, choices, disabled }: { f: Field; value: string; onChange: (v: string) => void; options: string[]; choices?: { value: string; label: string }[]; disabled: boolean }) {
  const common = { id: `f-${f.key}`, name: `entry-${f.key}`, autoComplete: 'off', disabled, value, onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement>) => onChange(e.target.value) };
  if (f.choose) {
    return (
      <select {...common} className="species-search doc-upload-field">
        <option value="">Choose…</option>
        {(choices ?? []).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
    );
  }
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
  const suggestions = useMemo((): Record<string, string[]> => ({ ...suggestionsFrom(data), plantSpecies: PLANT_SPECIES }), [data]);

  const [date, setDate] = useState(() => { const t = rwandaToday(); return t < FORMS_START_DATE ? FORMS_START_DATE : t; });
  const [values, setValues] = useState<Record<string, string>>(() => blankValues(spec.fields));
  const rowKeys = spec.rowKeys ?? [];
  const blankRow = () => Object.fromEntries(rowKeys.map(k => [k, blankValues(spec.fields)[k]]));
  const [rows, setRows] = useState<Record<string, string>[]>(() => [blankRow()]);
  const [editing, setEditing] = useState<string | null>(null);
  const [entries, setEntries] = useState<FormEntry[] | null>(null);
  const [plantingEntries, setPlantingEntries] = useState<FormEntry[]>([]);
  const needsPlantings = formId === 'survival-check';
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(30);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [ok, setOk] = useState('');

  const refresh = useCallback(() => {
    fetchEntries(formId).then(setEntries).catch(() => setEntries([]));
    if (needsPlantings) fetchEntries('planting').then(setPlantingEntries).catch(() => setPlantingEntries([]));
  }, [formId, needsPlantings]);
  useEffect(() => { refresh(); }, [refresh]);

  function reset() {
    setEditing(null);
    setValues(blankValues(spec.fields));
    setRows([blankRow()]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setOk('');
    const today = rwandaToday();
    // several records at once: one per row, sharing the date and the other fields
    const several = rowKeys.length > 0 && !editing;
    const filled = (r: Record<string, string>) => rowKeys.some(k => (r[k] ?? '').trim() !== '');
    const filledRows = rows.filter(filled);
    const used = several && filledRows.length > 0 ? filledRows : [rows[0] ?? {}];
    const list = used.map(r => ({ ...values, ...r }));
    const checked = list.map(v => validateEntry(formId, date, v, { today }));
    const problems = checked.flatMap((c, i) => c.errors.map(m => (list.length > 1 ? `Row ${i + 1}: ${m}` : m)));
    if (problems.length) return setErrors(Array.from(new Set(problems)));
    const password = getStaffPassword();
    if (!password) return lockStaff();
    setBusy(true); setErrors([]);
    let saved = 0;
    try {
      for (const c of checked) {
        await callUploadFunction({ action: 'entry-save', password, form: formId, id: editing ?? undefined, entry_date: c.clean!.entry_date, data: c.clean!.data });
        saved += 1;
      }
      setOk(editing ? 'Updated.' : saved > 1 ? `Saved ${saved} entries.` : 'Saved.');
      reset();
      refresh();
    } catch (err) {
      if (saved > 0) { setRows(used.slice(saved)); refresh(); setOk(`Saved ${saved} of ${checked.length}. Fix the next row and save again.`); }
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
      setOk('Deleted.');
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
    const loaded = { ...blankValues(spec.fields), ...Object.fromEntries(Object.entries(entry.data).map(([k, v]) => [k, String(v)])) };
    setValues(loaded);
    setRows([Object.fromEntries(rowKeys.map(k => [k, loaded[k] ?? '']))]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const label = (key: string) => spec.fields.find(f => f.key === key)?.label ?? key;

  // survival checks: the list of plantings to choose from, and the checks that are due
  const plantingLabel = (en: FormEntry) => `${en.data.species}, ${en.data.sector}, ${en.entry_date} (${en.data.trees_planted} trees)`;
  const choices = plantingEntries.map(en => ({ value: en.id, label: plantingLabel(en) }));
  const plantingById = new Map(plantingEntries.map(en => [en.id, en]));
  const due = needsPlantings ? checksDue(buildRestoration([...plantingEntries, ...(entries ?? [])])?.plantings ?? [], rwandaToday()) : [];
  const q = query.trim().toLowerCase();
  const shown = (entries ?? []).filter(en => !q || en.entry_date.includes(q) || Object.values(en.data).some(v => String(v).toLowerCase().includes(q)));
  const cell = (k: string, en: FormEntry) => (k === 'planting_id' ? (plantingById.get(String(en.data[k])) ? plantingLabel(plantingById.get(String(en.data[k]))!) : '') : en.data[k] ?? '');

  return (
    <div className="report-page">
      <p className="doc-upload-help" style={{ marginBottom: 8 }}><Link href="/update" className="dash-report-link">Staff data tools</Link></p>
      <h1 className="heading" style={{ margin: '0 0 1.25rem' }}>{spec.title}</h1>

      <form className="glass-card doc-upload-panel entry-form" onSubmit={submit} noValidate>
        <div className="entry-grid">
          <label className="doc-upload-label" htmlFor="f-date">
            {spec.dateLabel} *
            <input id="f-date" type="date" min={spec.start ?? FORMS_START_DATE} max={rwandaToday()} value={date} disabled={busy} onChange={e => setDate(e.target.value)} className="species-search doc-upload-field" />
          </label>
          {spec.fields.filter(f => !rowKeys.includes(f.key)).map((f, i, all) => (
            <Fragment key={f.key}>
              {f.group && f.group !== all[i - 1]?.group && <p className="entry-wide entry-group">{f.group}</p>}
              <label className={`doc-upload-label${f.type === 'longtext' ? ' entry-wide' : ''}`} htmlFor={`f-${f.key}`}>
                {f.label}{f.required ? ' *' : ''}
                <FieldInput f={f} value={values[f.key] ?? ''} onChange={v => setValues(s => ({ ...s, [f.key]: v }))} options={f.suggest ? suggestions[f.suggest] ?? [] : []} choices={choices} disabled={busy} />
              </label>
              {f.key === 'planting_id' && (
                <label className="doc-upload-label">
                  Date planted
                  <input type="text" readOnly value={plantingById.get(values.planting_id ?? '')?.entry_date ?? ''} className="species-search doc-upload-field" tabIndex={-1} />
                </label>
              )}
            </Fragment>
          ))}
        </div>

        {rowKeys.length > 0 && (
          <div className="entry-rows">
            {rows.map((row, i) => (
              <div key={i} className="entry-row">
                {spec.fields.filter(f => rowKeys.includes(f.key)).map(f => (
                  <label key={f.key} className="doc-upload-label">
                    {f.label}{f.required ? ' *' : ''}
                    <FieldInput f={{ ...f, key: `${f.key}-${i}` }} value={row[f.key] ?? ''} onChange={v => setRows(rs => rs.map((r, j) => (j === i ? { ...r, [f.key]: v } : r)))} options={f.suggest ? suggestions[f.suggest] ?? [] : []} disabled={busy} />
                  </label>
                ))}
                {!editing && rows.length > 1 && (
                  <button type="button" className="entry-link entry-row-remove" disabled={busy} onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}>Remove</button>
                )}
              </div>
            ))}
            {!editing && (
              <button type="button" className="doc-action-btn doc-action-btn--ghost" disabled={busy} onClick={() => setRows(rs => [...rs, blankRow()])}>Add another species</button>
            )}
          </div>
        )}

        {errors.length > 0 && <div role="alert">{errors.map((m, i) => <p key={i} className="doc-upload-error">{m}</p>)}</div>}
        {ok && <p className="doc-upload-ok">{ok}</p>}

        <div className="doc-library-card-actions">
          <button type="submit" className="doc-action-btn doc-action-btn--primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Update entry' : 'Save entry'}</button>
          {editing && <button type="button" className="doc-action-btn doc-action-btn--ghost" disabled={busy} onClick={() => { reset(); setErrors([]); }}>Cancel edit</button>}
        </div>
      </form>

      {due.length > 0 && (
        <>
          <h2 className="doc-upload-title" style={{ margin: '1.5rem 0 8px' }}>Checks due</h2>
          <table className="report-table entry-table">
            <thead><tr><th>Due</th><th>Planting</th><th>Checkpoint</th><th></th></tr></thead>
            <tbody>
              {due.map(d => (
                <tr key={d.planting.id + d.checkpoint}>
                  <td>{d.due}</td><td>{d.planting.species}, {d.planting.sector}, {d.planting.date}</td><td>{d.checkpoint}</td><td>{d.overdue ? 'Overdue' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: '1.5rem 0 8px' }}>
        <h2 className="doc-upload-title" style={{ margin: 0 }}>Saved entries{entries ? ` (${entries.length})` : ''}</h2>
        {entries && entries.length > 5 && (
          <input type="search" placeholder="Search entries" value={query} onChange={e => { setQuery(e.target.value); setLimit(30); }} className="species-search" style={{ height: 36, maxWidth: 260, paddingLeft: 12 }} aria-label="Search entries" />
        )}
      </div>
      {entries === null ? (
        <p className="doc-upload-help">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="doc-upload-help">No entries yet.</p>
      ) : (
        <>
          <table className="report-table entry-table">
            <thead>
              <tr>
                <th>{spec.dateLabel}</th>
                {spec.listKeys.map(k => <th key={k}>{label(k)}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, limit).map(en => (
                <tr key={en.id}>
                  <td>{en.entry_date}</td>
                  {spec.listKeys.map(k => <td key={k}>{cell(k, en)}</td>)}
                  <td>
                    <button type="button" className="entry-link" disabled={busy} onClick={() => edit(en)}>Edit</button>
                    {' · '}
                    <button type="button" className="entry-link" disabled={busy} onClick={() => remove(en)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && <p className="doc-upload-help">No entries match.</p>}
          {shown.length > limit && (
            <button type="button" className="doc-action-btn doc-action-btn--ghost" style={{ marginTop: 10 }} onClick={() => setLimit(l => l + 30)}>Show more ({shown.length - limit} left)</button>
          )}
        </>
      )}
    </div>
  );
}
