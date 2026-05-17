/** Server-side species photo: iNaturalist → Wikipedia → IUCN Red List. */

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const WIKI_REST = 'https://en.wikipedia.org/api/rest_v1/page/summary';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const INAT_API = 'https://api.inaturalist.org/v1/taxa';
const USER_AGENT = 'NEP-Biodiversity-Dashboard/1.0 (educational research)';

export type SpeciesImageSource = 'inaturalist' | 'wikipedia' | 'iucn';

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

function isGenericIucnImage(url: string): boolean {
  return /logo|iucn-red-list|placeholder|default-image/i.test(url);
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

function parseOgImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  ];
  for (const re of patterns) {
    const url = re.exec(html)?.[1];
    if (url && !isGenericIucnImage(url)) return url;
  }
  return null;
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

type WikidataClaims = { imageFile?: string; iucnTaxonId?: string };

async function fetchWikidataClaims(scientific: string): Promise<WikidataClaims> {
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
  if (!id) return {};

  const entityParams = new URLSearchParams({
    action: 'wbgetentities',
    ids: id,
    props: 'claims',
    format: 'json',
  });
  const entityData = await fetchJson(`${WIKIDATA_API}?${entityParams}`) as {
    entities?: Record<string, {
      claims?: {
        P18?: { mainsnak?: { datavalue?: { value?: string } } }[];
        P809?: { mainsnak?: { datavalue?: { value?: string | number } } }[];
      };
    }>;
  } | null;

  const claims = entityData?.entities?.[id]?.claims;
  const imageFile = claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  const iucnRaw = claims?.P809?.[0]?.mainsnak?.datavalue?.value;

  return {
    imageFile: imageFile ?? undefined,
    iucnTaxonId: iucnRaw != null ? String(iucnRaw) : undefined,
  };
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

async function resolveIucnSpeciesPageUrl(scientific: string, iucnTaxonId?: string): Promise<string | null> {
  if (iucnTaxonId) return `https://www.iucnredlist.org/species/${iucnTaxonId}/0`;

  const html = await fetchHtml(
    `https://www.iucnredlist.org/search?query=${encodeURIComponent(scientific)}`,
  );
  const path = html?.match(/href=["'](\/species\/\d+\/0)["']/i)?.[1];
  return path ? `https://www.iucnredlist.org${path}` : null;
}

async function fetchIucnPhoto(scientific: string, iucnTaxonId?: string): Promise<string | null> {
  const pageUrl = await resolveIucnSpeciesPageUrl(scientific, iucnTaxonId);
  if (!pageUrl) return null;

  const html = await fetchHtml(pageUrl);
  if (!html) return null;

  return parseOgImage(html);
}

async function tryTitles(
  titles: (string | undefined)[],
  fetcher: (t: string) => Promise<string | null>,
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
  commonName?: string,
): Promise<{ url: string; source: SpeciesImageSource } | null> {
  const scientific = scientificName?.trim();
  if (!scientific) return null;

  const titles = [scientific, commonName];

  let url = await fetchInatPhoto(scientific);
  if (url) return { url, source: 'inaturalist' };

  url = await tryTitles(titles, fetchWikiRestThumb);
  if (url) return { url, source: 'wikipedia' };

  url = await tryTitles(titles, fetchWikiThumb);
  if (url) return { url, source: 'wikipedia' };

  url = await searchWiki(scientific);
  if (url) return { url, source: 'wikipedia' };

  if (commonName?.trim()) {
    url = await searchWiki(commonName.trim());
    if (url) return { url, source: 'wikipedia' };
  }

  const wikidata = await fetchWikidataClaims(scientific);
  if (wikidata.imageFile) {
    const commonsUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(wikidata.imageFile)}?width=800`;
    if (!isLikelyIllustration(commonsUrl)) {
      return { url: commonsUrl, source: 'wikipedia' };
    }
  }

  url = await fetchIucnPhoto(scientific, wikidata.iucnTaxonId);
  if (url) return { url, source: 'iucn' };

  return null;
}
