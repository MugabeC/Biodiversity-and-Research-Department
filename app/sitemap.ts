import type { MetadataRoute } from 'next';

const SITE = 'https://biodiversity-and-research-departmen-roan.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/species', '/wildlife', '/map', '/documents', '/report'].map(path => ({ url: `${SITE}${path}` }));
}
