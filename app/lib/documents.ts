export type DocumentType = 'pdf' | 'word' | 'excel';

export type LibraryDocument = {
  id: string;
  title: string;
  description: string;
  filename: string;
  type: DocumentType;
  /** Public Supabase Storage URL */
  url: string;
};

const SUPABASE_DOCS =
  'https://dakgnvnaqiosizouuciy.supabase.co/storage/v1/object/public/Biodiversity%20and%20Research%20Department';

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
    title: 'Community Data — Edited',
    description: 'Updated community engagement, school visits, passes, and waste workbook.',
    filename: 'Community Data-edited.xlsx',
    type: 'excel',
    url: docUrl('Community Data-edited.xlsx'),
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
  return 'Excel';
}
