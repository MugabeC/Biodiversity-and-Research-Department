export type DocumentType = 'pdf' | 'word' | 'excel' | 'powerpoint';

export type LibraryDocument = {
  id: string;
  title: string;
  description: string;
  filename: string;
  type: DocumentType;
  /** Public Supabase Storage URL */
  url: string;
  /** True for documents added from the website (they can be removed with the upload password). */
  uploaded?: boolean;
  uploadedAt?: string;
  sizeBytes?: number | null;
};

const SUPABASE_URL = 'https://dakgnvnaqiosizouuciy.supabase.co';
/** Publishable (public) key: it can only read the document list; writing needs the upload password. */
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_oQDiC7Y224MSpc2ip23KGg_jjwjMlG9';
/** Supabase Edge Function that checks the upload password and handles uploads and removals. */
export const UPLOAD_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/upload-document`;
export const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx';
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const SUPABASE_DOCS =
  `${SUPABASE_URL}/storage/v1/object/public/Biodiversity%20and%20Research%20Department`;

function docUrl(filename: string): string {
  return `${SUPABASE_DOCS}/${filename.split('/').map(encodeURIComponent).join('/')}`;
}

/** Park policies, plans, and department reports — hosted on Supabase Storage. */
export const DOCUMENT_LIBRARY: LibraryDocument[] = [
  {
    id: 'dos-donts-2023',
    title: "Dos and Don'ts (2023)",
    description: 'Visitor guidelines for Nyandungu Eco-Park.',
    filename: 'Dos And Donts- 2023.pdf',
    type: 'pdf',
    url: docUrl('Dos And Donts- 2023.pdf'),
  },
  {
    id: 'eco-park-presentation',
    title: 'Nyandungu Eco Park — General Presentation',
    description: 'Overview presentation of the park and programmes.',
    filename: 'Nyandungu Eco Park general Presentation..pdf',
    type: 'pdf',
    url: docUrl('Nyandungu Eco Park general Presentation..pdf'),
  },
  {
    id: 'feasibility-study-2023',
    title: 'Feasibility Study (2023)',
    description: 'NEP feasibility assessment and background.',
    filename: 'NEP Feasibility study 2023.pdf',
    type: 'pdf',
    url: docUrl('NEP Feasibility study 2023.pdf'),
  },
  {
    id: 'business-management-plan',
    title: 'Business & Long-term Management Plan',
    description: 'Business case and long-term park management planning.',
    filename: 'NEP Business and longterm management plan.pdf',
    type: 'pdf',
    url: docUrl('NEP Business and longterm management plan.pdf'),
  },
  {
    id: 'watercourse-hydrological',
    title: 'Watercourse Assessment — Hydrological',
    description: 'Hydrological watercourse assessment for the park.',
    filename: 'NEP_Watercourse_Assessment_Hydrological.pdf',
    type: 'pdf',
    url: docUrl('NEP_Watercourse_Assessment_Hydrological.pdf'),
  },
  {
    id: 'biodiversity-survey-2025',
    title: 'Biodiversity Survey 2025',
    description: 'Final report for the biodiversity survey at Nyandungu Eco-Park.',
    filename: 'RCID- Final Report for Biodiversity survey at NEP.pdf',
    type: 'pdf',
    url: docUrl('RCID- Final Report for Biodiversity survey at NEP.pdf'),
  },
  {
    id: 'research-policy',
    title: 'Research Policy',
    description: 'Department research policy and procedures.',
    filename: 'RESEARCH POLICY.docx',
    type: 'word',
    url: docUrl('RESEARCH POLICY.docx'),
  },
  {
    id: 'emergency-response-plan',
    title: 'Emergency Response Plan',
    description: 'Emergency preparedness and response procedures.',
    filename: 'EMERGENCY RESPONSE PLAN.docx',
    type: 'word',
    url: docUrl('EMERGENCY RESPONSE PLAN.docx'),
  },
  {
    id: 'biodiversity-index-corrected',
    title: 'Biodiversity Index (Corrected)',
    description: 'Corrected NEP biodiversity index workbook.',
    filename: 'NEP_Biodiversity_Index_Corrected.xlsx',
    type: 'excel',
    url: docUrl('NEP_Biodiversity_Index_Corrected.xlsx'),
  },
  {
    id: 'water-quality-comprehensive',
    title: 'Water Quality — Comprehensive',
    description: 'Comprehensive water quality monitoring workbook.',
    filename: 'NEP_Water_Quality_Comprehensive (2) (1).xlsx',
    type: 'excel',
    url: docUrl('NEP_Water_Quality_Comprehensive (2) (1).xlsx'),
  },
  {
    id: 'research-database',
    title: 'Research Database',
    description: 'Research requests and coordination database workbook.',
    filename: 'Research Database.xlsx',
    type: 'excel',
    url: docUrl('Research Database.xlsx'),
  },
  {
    id: 'community-data-edited',
    title: 'NEP Community Data 2025–2026',
    description: 'Updated community engagement, school visits, passes, and waste workbook.',
    filename: 'NEP Community Data 2025-2026.xlsx',
    type: 'excel',
    url: docUrl('NEP Community Data 2025-2026.xlsx'),
  },
];

export function getDocumentById(id: string | undefined): LibraryDocument | undefined {
  if (!id) return undefined;
  return DOCUMENT_LIBRARY.find(d => d.id === id);
}

export function documentHref(doc: LibraryDocument): string {
  return doc.url;
}

export function documentTypeLabel(type: DocumentType): string {
  if (type === 'pdf') return 'PDF';
  if (type === 'word') return 'Word';
  if (type === 'powerpoint') return 'PowerPoint';
  return 'Excel';
}

// ── Documents uploaded from the website ───────────────────────────────────────

type UploadedRow = {
  id: string;
  title: string;
  description: string | null;
  filename: string;
  storage_path: string;
  file_type: DocumentType;
  size_bytes: number | null;
  uploaded_at: string;
};

function rowToDocument(row: UploadedRow): LibraryDocument {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    filename: row.filename,
    type: row.file_type,
    url: docUrl(row.storage_path),
    uploaded: true,
    uploadedAt: row.uploaded_at,
    sizeBytes: row.size_bytes,
  };
}

async function queryUploaded(filter: string): Promise<LibraryDocument[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/library_documents?select=*&order=uploaded_at.desc${filter}`,
      { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` }, cache: 'no-store' },
    );
    if (!res.ok) return [];
    return ((await res.json()) as UploadedRow[]).map(rowToDocument);
  } catch {
    return []; // if the list cannot be reached, the built-in documents still show
  }
}

/** Documents added from the website, newest first. */
export function fetchUploadedDocuments(): Promise<LibraryDocument[]> {
  return queryUploaded('');
}

/** A built-in document, or one added from the website. */
export async function getAnyDocumentById(id: string | undefined): Promise<LibraryDocument | undefined> {
  const builtIn = getDocumentById(id);
  if (builtIn || !id) return builtIn;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  return (await queryUploaded(`&id=eq.${id}`))[0];
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '';
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// ── Categories (for filtering on the Documents page) ──────────────────────────

export type DocumentCategory = 'Policies & plans' | 'Reports & studies' | 'Data workbooks';
export const DOCUMENT_CATEGORIES: DocumentCategory[] = ['Policies & plans', 'Reports & studies', 'Data workbooks'];

const POLICY_IDS = new Set(['dos-donts-2023', 'eco-park-presentation', 'business-management-plan', 'research-policy', 'emergency-response-plan']);

export function documentCategory(doc: LibraryDocument): DocumentCategory {
  if (POLICY_IDS.has(doc.id)) return 'Policies & plans';
  if (doc.type === 'excel') return 'Data workbooks';
  return 'Reports & studies';
}
