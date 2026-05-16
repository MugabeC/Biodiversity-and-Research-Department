export type DocumentType = 'pdf' | 'word' | 'excel';

export type LibraryDocument = {
  id: string;
  title: string;
  description: string;
  filename: string;
  type: DocumentType;
};

/** Files in public/data — policies, plans, and department reports (not JSON datasets). */
export const DOCUMENT_LIBRARY: LibraryDocument[] = [
  {
    id: 'dos-donts-2023',
    title: "Dos and Don'ts (2023)",
    description: 'Visitor guidelines for Nyandungu Eco-Park.',
    filename: 'Dos And Donts- 2023.pdf',
    type: 'pdf',
  },
  {
    id: 'eco-park-presentation',
    title: 'Nyandungu Eco Park — General Presentation',
    description: 'Overview presentation of the park and programmes.',
    filename: 'Nyandungu Eco Park general Presentation..pdf',
    type: 'pdf',
  },
  {
    id: 'feasibility-study-2023',
    title: 'Feasibility Study (2023)',
    description: 'NEP feasibility assessment and background.',
    filename: 'NEP Feasibility study 2023.pdf',
    type: 'pdf',
  },
  {
    id: 'business-management-plan',
    title: 'Business & Long-term Management Plan',
    description: 'Business case and long-term park management planning.',
    filename: 'NEP Business and longterm management plan.pdf',
    type: 'pdf',
  },
  {
    id: 'watercourse-hydrological',
    title: 'Watercourse Assessment — Hydrological',
    description: 'Hydrological watercourse assessment for the park.',
    filename: 'NEP_Watercourse_Assessment_Hydrological.pdf',
    type: 'pdf',
  },
  {
    id: 'research-policy',
    title: 'Research Policy',
    description: 'Department research policy and procedures.',
    filename: 'RESEARCH POLICY.docx',
    type: 'word',
  },
  {
    id: 'emergency-response-plan',
    title: 'Emergency Response Plan',
    description: 'Emergency preparedness and response procedures.',
    filename: 'EMERGENCY RESPONSE PLAN.docx',
    type: 'word',
  },
  {
    id: 'volunteering-policy',
    title: 'Volunteering Policy',
    description: 'Volunteer programme policy and expectations.',
    filename: 'VOLUNTEERING POLICY.docx',
    type: 'word',
  },
  {
    id: 'water-quality-comprehensive',
    title: 'Water Quality — Comprehensive',
    description: 'Comprehensive water quality monitoring workbook.',
    filename: 'NEP_Water_Quality_Comprehensive (2) (1).xlsx',
    type: 'excel',
  },
  {
    id: 'community-data-2025-2026',
    title: 'Community Data 2025–2026',
    description: 'Community engagement and outreach data export.',
    filename: 'NEP Community Data 2025 2026 (1).xlsx',
    type: 'excel',
  },
];

export function getDocumentById(id: string | undefined): LibraryDocument | undefined {
  if (!id) return undefined;
  return DOCUMENT_LIBRARY.find(d => d.id === id);
}

export function documentHref(doc: LibraryDocument): string {
  return `/data/${doc.filename.split('/').map(encodeURIComponent).join('/')}`;
}

export function documentTypeLabel(type: DocumentType): string {
  if (type === 'pdf') return 'PDF';
  if (type === 'word') return 'Word';
  return 'Excel';
}
