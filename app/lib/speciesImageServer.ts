/** Server-side: resolve species photo URL (Wikipedia REST → Wikidata → iNaturalist). */

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const WIKI_REST = 'https://en.wikipedia.org/api/rest_v1/page/summary';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const INAT_API = 'https://api.inaturalist.org/v1/taxa';

function wikiSlug(name: string): string {
  return encodeURIComponent(name.trim().replace(/ /g, '_'));
}

function wikiTitle(name: string): string {
  return name.trim().replace(/ /g, '_');
}

function upscaleWikiThumb(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(/\/(\d+)px-/g, '/800px-');
}

function isLikelyIllustration(url: string | null | undefined): boolean {
  if (!url) return false;
  return /Plate|plate_|illustration|engraving|drawing|_print\.|Rohrweihe|John_Gould|Gould/i.test(url);
}

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) return null;
  return res.json();
}

async function fetchWikiRestThumb(title: string): Promise<string | null> {
  const data = await fetchJson(`${WIKI_REST}/${wikiSlug(title)}`) as {
    thumbnail?: { source?: string };
  } | null;
  const url = upscaleWikiThumb(data?.thumbnail?.source);
  if (!url || isLikelyIllustration(url)) return null;
  return url;
}

async function fetchWikiThumb(title: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: 'query',
    titles: wikiTitle(title),
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: '800',
    redirects: '1',
    format: 'json',
  });
  const data = await fetchJson(`${WIKI_API}?${params}`) as {
    query?: { pages?: Record<string, { missing?: string; thumbnail?: { source?: string } }> };
  } | null;
  const pages = data?.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  if (page?.missing || !page?.thumbnail?.source) return null;
  const url = upscaleWikiThumb(page.thumbnail.source);
  if (!url || isLikelyIllustration(url)) return null;
  return url;
}

async function searchWiki(query: string): Promise<string | null> {
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
  const data = await fetchJson(`${WIKI_API}?${params}`) as {
    query?: { pages?: Record<string, { thumbnail?: { source?: string } }> };
  } | null;
  const pages = data?.query?.pages;
  if (!pages) return null;
  for (const page of Object.values(pages)) {
    const url = upscaleWikiThumb(page?.thumbnail?.source);
    if (url && !isLikelyIllustration(url)) return url;
  }
  return null;
}

async function fetchWikidataImage(scientific: string): Promise<string | null> {
  const searchParams = new URLSearchParams({
    action: 'wbsearchentities',
    search: scientific,
    language: 'en',
    format: 'json',
    limit: '1',
  });
  const search = await fetchJson(`${WIKIDATA_API}?${searchParams}`) as {
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
  const entityData = await fetchJson(`${WIKIDATA_API}?${entityParams}`) as {
    entities?: Record<string, { claims?: { P18?: { mainsnak?: { datavalue?: { value?: string } } }[] } }>;
  } | null;
  const fileName = entityData?.entities?.[id]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  if (!fileName) return null;
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=800`;
  if (isLikelyIllustration(url)) return null;
  return url;
}

async function fetchInatPhoto(scientific: string): Promise<string | null> {
  const params = new URLSearchParams({
    q: scientific,
    rank: 'species',
    is_active: 'true',
    per_page: '8',
    order_by: 'observations',
  });
  const data = await fetchJson(`${INAT_API}?${params}`) as {
    results?: { name?: string; default_photo?: { medium_url?: string; url?: string } }[];
  } | null;
  const sci = scientific.toLowerCase();
  const taxon =
    data?.results?.find(t => (t.name || '').toLowerCase() === sci) ?? data?.results?.[0];
  const photo = taxon?.default_photo;
  return photo?.medium_url ?? photo?.url ?? null;
}

async function tryTitles(
  titles: (string | undefined)[],
  fetcher: (t: string) => Promise<string | null>
): Promise<string | null> {
  for (const t of titles) {
    if (!t?.trim()) continue;
    const url = await fetcher(t.trim());
    if (url) return url;
  }
  return null;
}

export async function resolveSpeciesImageUrl(
  scientificName: string,
  commonName?: string
): Promise<{ url: string; source: 'wikipedia' | 'inaturalist' } | null> {
  const scientific = scientificName?.trim();
  if (!scientific) return null;

  const titles = [scientific, commonName];

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
