/** Species text: Wikipedia first, then IUCN Red List page summary. */

const WIKI_REST = 'https://en.wikipedia.org/api/rest_v1/page/summary';
const USER_AGENT = 'NEP-Biodiversity-Dashboard/1.0 (educational research)';

function wikiSlug(name: string): string {
  return encodeURIComponent(name.trim().replace(/ /g, '_'));
}

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchHtml(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  return res.text();
}

function toCompleteDescription(extract: string, maxChars = 1200): string {
  if (!extract?.trim()) return '';
  const text = extract.replace(/\s+/g, ' ').trim();
  if (text.length <= maxChars) return text;

  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [text];
  let out = '';
  for (const s of sentences) {
    const next = out + s;
    if (next.length > maxChars && out.length > 0) break;
    out = next;
  }
  return out.trim() || `${text.slice(0, maxChars).replace(/\s+\S*$/, '').trim()}.`;
}

async function fetchWikipediaDescription(
  scientificName: string,
  commonName?: string,
): Promise<string> {
  const names = [scientificName, commonName].filter(Boolean) as string[];
  for (const name of names) {
    const data = await fetchJson(`${WIKI_REST}/${wikiSlug(name)}`) as {
      extract?: string;
    } | null;
    if (data?.extract) return toCompleteDescription(data.extract);
  }
  return '';
}

async function fetchWikidataIucnTaxonId(scientific: string): Promise<string | null> {
  const searchParams = new URLSearchParams({
    action: 'wbsearchentities',
    search: scientific,
    language: 'en',
    format: 'json',
    limit: '1',
  });
  const search = await fetchJson(`https://www.wikidata.org/w/api.php?${searchParams}`) as {
    search?: { id: string }[];
  } | null;
  const id = search?.search?.[0]?.id;
  if (!id) return null;

  const entityParams = new URLSearchParams({
    action: 'wbgetentities',
    ids: id,
    props: 'claims',
    format: 'json',
  });
  const entityData = await fetchJson(`https://www.wikidata.org/w/api.php?${entityParams}`) as {
    entities?: Record<string, { claims?: { P809?: { mainsnak?: { datavalue?: { value?: string | number } } }[] } }>;
  } | null;
  const taxonId = entityData?.entities?.[id]?.claims?.P809?.[0]?.mainsnak?.datavalue?.value;
  return taxonId != null ? String(taxonId) : null;
}

function parseMetaContent(html: string, kind: 'og:description' | 'description'): string | null {
  const patterns =
    kind === 'og:description'
      ? [
          /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
          /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
        ]
      : [
          /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
          /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
        ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

async function resolveIucnSpeciesPageUrl(scientific: string): Promise<string | null> {
  const taxonId = await fetchWikidataIucnTaxonId(scientific);
  if (taxonId) return `https://www.iucnredlist.org/species/${taxonId}/0`;

  const html = await fetchHtml(
    `https://www.iucnredlist.org/search?query=${encodeURIComponent(scientific)}`,
  );
  const path = html?.match(/href=["'](\/species\/\d+\/0)["']/i)?.[1];
  return path ? `https://www.iucnredlist.org${path}` : null;
}

async function fetchIucnDescription(scientificName: string): Promise<string> {
  const pageUrl = await resolveIucnSpeciesPageUrl(scientificName);
  if (!pageUrl) return '';

  const html = await fetchHtml(pageUrl);
  if (!html) return '';

  const og = parseMetaContent(html, 'og:description');
  const meta = parseMetaContent(html, 'description');
  const raw = og || meta || '';
  if (!raw || /iucn red list|search results/i.test(raw)) return '';
  return toCompleteDescription(raw, 900);
}

export async function resolveSpeciesDescription(
  scientificName: string,
  commonName?: string,
): Promise<{ description: string; source: 'wikipedia' | 'iucn' | null }> {
  const scientific = scientificName?.trim();
  if (!scientific) return { description: '', source: null };

  const wiki = await fetchWikipediaDescription(scientific, commonName);
  if (wiki) return { description: wiki, source: 'wikipedia' };

  const iucn = await fetchIucnDescription(scientific);
  if (iucn) return { description: iucn, source: 'iucn' };

  return { description: '', source: null };
}
