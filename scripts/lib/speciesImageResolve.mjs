/** Species photo resolver: Wikipedia REST → Wikidata → iNaturalist. */

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const WIKI_REST = 'https://en.wikipedia.org/api/rest_v1/page/summary';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const INAT_API = 'https://api.inaturalist.org/v1/taxa';
const USER_AGENT = 'NEP-Biodiversity-Dashboard/1.0 (educational research)';

function wikiSlug(name) {
  return encodeURIComponent(name.trim().replace(/ /g, '_'));
}

function wikiTitle(name) {
  return name.trim().replace(/ /g, '_');
}

function upscaleWikiThumb(url) {
  if (!url) return null;
  return url.replace(/\/(\d+)px-/g, '/800px-');
}

/** Skip historic plates / wrong taxon artwork when a photo exists elsewhere. */
function isLikelyIllustration(url) {
  if (!url) return false;
  return /Plate|plate_|illustration|engraving|drawing|_print\.|Rohrweihe|John_Gould|Gould/i.test(url);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) return null;
  return res.json();
}

async function fetchWikiRestThumb(title) {
  const data = await fetchJson(`${WIKI_REST}/${wikiSlug(title)}`);
  if (!data?.thumbnail?.source) return null;
  const url = upscaleWikiThumb(data.thumbnail.source);
  if (isLikelyIllustration(url)) return null;
  return url;
}

async function fetchWikiThumb(title) {
  const params = new URLSearchParams({
    action: 'query',
    titles: wikiTitle(title),
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: '800',
    redirects: '1',
    format: 'json',
  });
  const data = await fetchJson(`${WIKI_API}?${params}`);
  const pages = data?.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  if (page?.missing || !page?.thumbnail?.source) return null;
  const url = upscaleWikiThumb(page.thumbnail.source);
  if (isLikelyIllustration(url)) return null;
  return url;
}

async function searchWiki(query) {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '0',
    gsrlimit: '3',
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: '800',
    format: 'json',
  });
  const data = await fetchJson(`${WIKI_API}?${params}`);
  const pages = data?.query?.pages;
  if (!pages) return null;
  for (const page of Object.values(pages)) {
    const url = upscaleWikiThumb(page?.thumbnail?.source);
    if (url && !isLikelyIllustration(url)) return url;
  }
  return null;
}

async function fetchWikidataImage(scientific) {
  const searchParams = new URLSearchParams({
    action: 'wbsearchentities',
    search: scientific,
    language: 'en',
    format: 'json',
    limit: '1',
  });
  const search = await fetchJson(`${WIKIDATA_API}?${searchParams}`);
  const id = search?.search?.[0]?.id;
  if (!id) return null;

  const entityParams = new URLSearchParams({
    action: 'wbgetentities',
    ids: id,
    props: 'claims',
    format: 'json',
  });
  const entityData = await fetchJson(`${WIKIDATA_API}?${entityParams}`);
  const claims = entityData?.entities?.[id]?.claims?.P18;
  const fileName = claims?.[0]?.mainsnak?.datavalue?.value;
  if (!fileName) return null;

  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=800`;
  if (isLikelyIllustration(url)) return null;
  return url;
}

async function fetchInatPhoto(scientific) {
  const params = new URLSearchParams({
    q: scientific,
    rank: 'species',
    is_active: 'true',
    per_page: '8',
    order_by: 'observations',
  });
  const data = await fetchJson(`${INAT_API}?${params}`);
  const sci = scientific.toLowerCase();
  const taxon = (data?.results ?? []).find(t => {
    const name = (t.name || '').toLowerCase();
    return name === sci || name.replace(/ /g, '') === sci.replace(/ /g, '');
  }) ?? data?.results?.[0];
  const photo = taxon?.default_photo;
  return photo?.medium_url ?? photo?.url ?? null;
}

async function tryTitles(titles, fetcher) {
  for (const t of titles) {
    if (!t?.trim()) continue;
    const url = await fetcher(t.trim());
    if (url) return url;
  }
  return null;
}

export async function resolveSpeciesImageUrl(scientificName, commonName) {
  const scientific = scientificName?.trim();
  if (!scientific) return null;

  const titles = [scientific, commonName].filter(Boolean);

  let url = await tryTitles(titles, fetchWikiRestThumb);
  if (url) return { url, source: 'wikipedia' };

  url = await tryTitles(titles, fetchWikiThumb);
  if (url) return { url, source: 'wikipedia' };

  url = await searchWiki(scientific);
  if (url) return { url, source: 'wikipedia' };

  if (commonName?.trim()) {
    url = await searchWiki(commonName.trim());
    if (url) return { url, source: 'wikipedia' };
  }

  url = await fetchWikidataImage(scientific);
  if (url) return { url, source: 'wikipedia' };

  url = await fetchInatPhoto(scientific);
  if (url) return { url, source: 'inaturalist' };

  return null;
}

export function getScientificName(row) {
  return (row.scientificName || row.genusSpecies || '').trim();
}

export function getCommonName(row) {
  return (row.commonName || '').trim();
}

export function speciesUid(row) {
  return `${row.taxa}-${row.id}`;
}
