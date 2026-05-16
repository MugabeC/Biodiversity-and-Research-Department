/** Wikipedia intro extract — complete sentences only (no mid-sentence cuts). */

const REST_BASE = 'https://en.wikipedia.org/api/rest_v1/page/summary';
const USER_AGENT = 'NEP-Biodiversity-Dashboard/1.0 (educational research)';

function wikiSlug(name) {
  return encodeURIComponent(name.trim().replace(/ /g, '_'));
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) return null;
  return res.json();
}

async function fetchSummary(title) {
  const data = await fetchJson(`${REST_BASE}/${wikiSlug(title)}`);
  if (!data?.extract) return null;
  return { extract: data.extract, title: data.title };
}

async function searchWikiTitle(query) {
  const params = new URLSearchParams({
    action: 'opensearch',
    search: query,
    limit: '1',
    namespace: '0',
    format: 'json',
  });
  const data = await fetchJson(`https://en.wikipedia.org/w/api.php?${params}`);
  const title = data?.[1]?.[0];
  return title || null;
}

/** Keep full intro or first paragraph(s), ending only on sentence boundaries. */
export function toCompleteDescription(extract, maxChars = 1200) {
  if (!extract?.trim()) return '';
  let text = extract.replace(/\s+/g, ' ').trim();
  if (text.length <= maxChars) return text;

  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [text];
  let out = '';
  for (const s of sentences) {
    const next = out + s;
    if (next.length > maxChars && out.length > 0) break;
    out = next;
  }
  return out.trim() || text.slice(0, maxChars).replace(/\s+\S*$/, '').trim() + '.';
}

export async function fetchWikipediaDescription(scientificName, commonName) {
  const direct = [scientificName, commonName].filter(Boolean);
  for (const name of direct) {
    const summary = await fetchSummary(name);
    if (summary?.extract) return toCompleteDescription(summary.extract);
  }

  const searches = [
    scientificName,
    commonName,
    commonName && `${commonName} bird`,
  ].filter(Boolean);
  for (const q of searches) {
    const title = await searchWikiTitle(q);
    if (!title) continue;
    const summary = await fetchSummary(title);
    if (summary?.extract) return toCompleteDescription(summary.extract);
  }

  return '';
}
