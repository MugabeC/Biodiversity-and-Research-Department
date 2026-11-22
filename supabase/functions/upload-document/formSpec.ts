/**
 * Definitions and checks for the staff data-entry forms.
 *
 * This file has no imports on purpose: the identical copy in supabase/functions/upload-document/formSpec.ts runs the
 * same checks on the server, so a bad entry is refused even if someone bypasses the website.
 * scripts/check_form_spec.sh fails if the two copies differ.
 */

/** Entries on the forms start from this date. Everything before it came from the audited workbook. */
export const FORMS_START_DATE = '2026-11-22';

export type FieldType = 'text' | 'longtext' | 'int' | 'decimal' | 'date' | 'select';

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Longest text allowed. */
  max?: number;
  options?: string[];
  help?: string;
  /** Where the page gets its suggestions from (existing values already on the dashboard). */
  suggest?: string;
  /** Start value on a new entry. */
  initial?: string;
};

export type FormSpec = {
  id: string;
  title: string;
  section: 'community' | 'habitat';
  blurb: string;
  dateLabel: string;
  /** Keys shown in the list of recent entries. */
  listKeys: string[];
  fields: Field[];
  note?: string;
};

const PEOPLE_NOTE = 'Do not type phone numbers or personal contact details.';

export const FORM_SPECS: FormSpec[] = [
  {
    id: 'school-visit',
    title: 'School visit',
    section: 'community',
    blurb: 'One school group visiting the park.',
    dateLabel: 'Visit date',
    listKeys: ['school', 'students'],
    fields: [
      { key: 'school', label: 'School or group', type: 'text', required: true, max: 160, suggest: 'schools' },
      { key: 'students', label: 'Students', type: 'int', required: true },
      { key: 'school_groups', label: 'School groups', type: 'int', initial: '1', help: 'Usually 1 for one school.' },
      { key: 'teachers', label: 'Teachers', type: 'int' },
      { key: 'other_adults', label: 'Other adults', type: 'int' },
      { key: 'complimentary', label: 'Complimentary participants', type: 'int', help: 'Counted in complimentary admissions.' },
      { key: 'programme', label: 'Programme', type: 'text', max: 120, suggest: 'programmes' },
      { key: 'programme_pupils', label: 'Programme pupils', type: 'int' },
    ],
  },
  {
    id: 'community-activity',
    title: 'Community engagement activity',
    section: 'community',
    blurb: 'A meeting, visit, training or event with community members, partners or delegates.',
    dateLabel: 'Activity date',
    listKeys: ['activity', 'participants'],
    note: PEOPLE_NOTE,
    fields: [
      { key: 'activity', label: 'Activity', type: 'text', required: true, max: 200 },
      { key: 'participant_group', label: 'Participant group', type: 'text', max: 120, suggest: 'participantGroups' },
      { key: 'participants', label: 'Participants', type: 'int' },
      { key: 'women', label: 'Women', type: 'int' },
      { key: 'men', label: 'Men', type: 'int' },
      { key: 'institutions', label: 'Institutions', type: 'int' },
      { key: 'complimentary', label: 'Complimentary participants', type: 'int', help: 'Counted in complimentary admissions.' },
    ],
  },
  {
    id: 'complimentary-pass',
    title: 'Complimentary admission',
    section: 'community',
    blurb: 'Free entry given to a group that is not part of a school visit or community activity entered above.',
    dateLabel: 'Date given',
    listKeys: ['group', 'count'],
    fields: [
      { key: 'group', label: 'Group or category', type: 'text', required: true, max: 200, suggest: 'passGroups' },
      { key: 'count', label: 'Number of people', type: 'int', required: true },
      { key: 'notes', label: 'Note', type: 'text', max: 160, initial: 'Identified admissions' },
    ],
  },
  {
    id: 'internship-application',
    title: 'Internship application',
    section: 'community',
    blurb: 'Counts only. Applicant names are never collected or shown.',
    dateLabel: 'Date received',
    listKeys: ['type', 'institution'],
    note: 'Do not type applicant names or contact details.',
    fields: [
      { key: 'type', label: 'Type', type: 'select', required: true, options: ['Academic', 'Professional'] },
      { key: 'institution', label: 'Institution', type: 'text', max: 120, suggest: 'institutions' },
      { key: 'requested_period', label: 'Requested period', type: 'text', max: 60, suggest: 'periods' },
      {
        key: 'stage', label: 'Stage', type: 'select', required: true,
        options: ['Application received', 'Invited for discussion', 'Additional documents requested', 'Under review', 'With HR', 'Placement started', 'Not proceeding'],
        help: 'Edit the entry later when the stage changes.',
      },
      { key: 'start_date', label: 'Placement start date', type: 'date', help: 'Only when the placement has a start date.' },
    ],
  },
  {
    id: 'research-request',
    title: 'Research request',
    section: 'community',
    blurb: 'A request to do research or collect data in the park. Researcher names are shown publicly.',
    dateLabel: 'Date received',
    listKeys: ['names', 'status'],
    note: PEOPLE_NOTE,
    fields: [
      { key: 'names', label: 'Applicant or group', type: 'text', required: true, max: 160 },
      { key: 'category', label: 'Category', type: 'select', required: true, options: ['Academic Research', 'Professional Research', 'Other'] },
      { key: 'institution', label: 'Institution', type: 'text', max: 120, suggest: 'institutions' },
      { key: 'program', label: 'Programme or degree level', type: 'text', max: 160 },
      { key: 'topic', label: 'Research title or topic', type: 'longtext', required: true, max: 400 },
      { key: 'requested_activities', label: 'Requested activity', type: 'text', max: 300, suggest: 'activities' },
      { key: 'status', label: 'Status', type: 'select', required: true, options: ['Pending', 'Approved / permission granted', 'Under review / revise', 'Advised to revise', 'Declined'] },
      { key: 'internal_remarks', label: 'Internal remarks', type: 'longtext', max: 600 },
      { key: 'action_taken', label: 'Action taken', type: 'longtext', max: 600 },
      { key: 'follow_up_date', label: 'Follow-up date', type: 'date' },
      { key: 'assigned_contact', label: 'Assigned to', type: 'text', max: 120, help: 'A staff name only.' },
    ],
  },
  {
    id: 'conflict-case',
    title: 'Conflict case',
    section: 'community',
    blurb: 'A human and wildlife conflict, encroachment or pollution case reported to the park.',
    dateLabel: 'Date reported',
    listKeys: ['issue_type', 'status'],
    note: 'Do not type names or phone numbers of community members or reporters.',
    fields: [
      { key: 'stakeholder', label: 'Stakeholder type', type: 'text', max: 100, suggest: 'stakeholders' },
      { key: 'area_type', label: 'Area type', type: 'text', max: 100, suggest: 'areaTypes' },
      { key: 'location', label: 'Location', type: 'text', max: 300 },
      { key: 'category', label: 'Category', type: 'text', max: 100, suggest: 'categories' },
      { key: 'issue_type', label: 'Issue type', type: 'text', required: true, max: 100, suggest: 'issueTypes' },
      { key: 'description', label: 'Description', type: 'longtext', required: true, max: 800 },
      { key: 'affected_area', label: 'Affected area', type: 'text', max: 160, suggest: 'affectedAreas' },
      { key: 'action_type', label: 'Action type', type: 'text', max: 120, suggest: 'actionTypes' },
      { key: 'assigned_to', label: 'Assigned to', type: 'text', max: 160, help: 'Staff names only.' },
      { key: 'status', label: 'Status', type: 'select', required: true, options: ['Open', 'In progress', 'Resolved'] },
      { key: 'resolution_date', label: 'Resolution date', type: 'date' },
      { key: 'action_taken', label: 'Action taken', type: 'longtext', max: 600 },
      { key: 'follow_up_required', label: 'Follow-up required', type: 'text', max: 200 },
    ],
  },
  {
    id: 'waste',
    title: 'Waste collected',
    section: 'habitat',
    blurb: 'One waste collection. Collections in the same month are added together.',
    dateLabel: 'Collection date',
    listKeys: ['total_kg', 'note'],
    fields: [
      { key: 'total_kg', label: 'Total waste (kg)', type: 'decimal', required: true },
      { key: 'biodegradable_kg', label: 'Biodegradable (kg)', type: 'decimal', help: 'Fill both split fields or neither. They must add up to the total.' },
      { key: 'non_biodegradable_kg', label: 'Non-biodegradable (kg)', type: 'decimal' },
      { key: 'note', label: 'Note', type: 'text', max: 200 },
    ],
  },
];

export const FORM_IDS = FORM_SPECS.map(f => f.id);
export const getFormSpec = (id: string): FormSpec | undefined => FORM_SPECS.find(f => f.id === id);

// ── checks ────────────────────────────────────────────────────────────────
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function isRealDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** "2026-11-22" becomes "November 2026", the label the dashboard files use. */
export function monthLabelOf(date: string): string {
  const [y, m] = date.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Text that looks like a phone number (nine or more digits). */
export function looksLikePhone(s: string): boolean {
  const digits = s.replace(/\D/g, '');
  return digits.length >= 9 && /(\+?\d[\d\s().-]{7,}\d)/.test(s);
}

export type EntryCheck = { errors: string[]; clean?: { entry_date: string; data: Record<string, string | number> } };

/**
 * Checks one entry and returns the cleaned values. `today` is the latest date allowed (the server passes its own date).
 */
export function validateEntry(
  formId: string,
  entryDate: unknown,
  data: unknown,
  opts: { today: string; start?: string },
): EntryCheck {
  const spec = getFormSpec(formId);
  if (!spec) return { errors: ['Unknown form.'] };
  const errors: string[] = [];
  const start = opts.start ?? FORMS_START_DATE;
  const raw = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;

  if (!isRealDate(entryDate)) errors.push(`${spec.dateLabel}: choose a valid date.`);
  else if (entryDate < start) errors.push(`${spec.dateLabel}: this form starts on ${start}. Earlier records are already in the workbook data.`);
  else if (entryDate > opts.today) errors.push(`${spec.dateLabel}: the date is in the future.`);

  const clean: Record<string, string | number> = {};
  const allowed = new Set(spec.fields.map(f => f.key));
  for (const k of Object.keys(raw)) if (!allowed.has(k)) errors.push(`Unexpected field "${k}".`);

  for (const f of spec.fields) {
    const v = raw[f.key];
    const blank = v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
    if (blank) {
      if (f.required) errors.push(`${f.label}: required.`);
      continue;
    }
    if (f.type === 'int' || f.type === 'decimal') {
      const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim());
      if (!Number.isFinite(n) || n < 0) { errors.push(`${f.label}: enter a number that is 0 or more.`); continue; }
      if (f.type === 'int' && !Number.isInteger(n)) { errors.push(`${f.label}: enter a whole number.`); continue; }
      if (n > 1_000_000) { errors.push(`${f.label}: the number is too large.`); continue; }
      clean[f.key] = f.type === 'decimal' ? Math.round(n * 100) / 100 : n;
    } else if (f.type === 'date') {
      if (!isRealDate(v)) { errors.push(`${f.label}: choose a valid date.`); continue; }
      clean[f.key] = v;
    } else {
      const s = String(v).trim().replace(/\s+/g, ' ');
      const limit = f.max ?? (f.type === 'longtext' ? 600 : 160);
      if (s.length > limit) { errors.push(`${f.label}: at most ${limit} characters.`); continue; }
      if (f.type === 'select' && !(f.options ?? []).includes(s)) { errors.push(`${f.label}: choose one of the options.`); continue; }
      if (f.type !== 'select' && looksLikePhone(s)) { errors.push(`${f.label}: this looks like a phone number. Remove it.`); continue; }
      clean[f.key] = s;
    }
  }

  const n = (k: string) => (typeof clean[k] === 'number' ? (clean[k] as number) : undefined);
  const s = (k: string) => (typeof clean[k] === 'string' ? (clean[k] as string) : undefined);
  if (formId === 'complimentary-pass' && n('count') !== undefined && (n('count') as number) < 1) errors.push('Number of people: at least 1.');
  if (formId === 'school-visit' && n('students') !== undefined && (n('students') as number) < 1) errors.push('Students: at least 1.');
  if (formId === 'internship-application' && s('start_date') && isRealDate(entryDate) && (s('start_date') as string) < entryDate) {
    errors.push('Placement start date: cannot be before the date received.');
  }
  if (formId === 'conflict-case' && s('resolution_date') && isRealDate(entryDate) && (s('resolution_date') as string) < entryDate) {
    errors.push('Resolution date: cannot be before the date reported.');
  }
  if (formId === 'conflict-case' && s('status') === 'Resolved' && !s('resolution_date')) errors.push('Resolution date: required when the status is Resolved.');
  if (formId === 'waste') {
    const bio = n('biodegradable_kg'), non = n('non_biodegradable_kg'), total = n('total_kg');
    if ((bio === undefined) !== (non === undefined)) errors.push('Fill both the biodegradable and the non-biodegradable weight, or neither.');
    else if (bio !== undefined && non !== undefined && total !== undefined && Math.abs(bio + non - total) > 0.5) {
      errors.push('Biodegradable plus non-biodegradable must equal the total.');
    }
    if (total !== undefined && total <= 0) errors.push('Total waste (kg): more than 0.');
  }

  if (errors.length) return { errors };
  return { errors: [], clean: { entry_date: entryDate as string, data: clean } };
}
