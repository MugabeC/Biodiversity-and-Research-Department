import type { MetadataRoute } from 'next';

const SITE = 'https://biodiversity-and-research-departmen-roan.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: ['/update', '/api/'] }, sitemap: `${SITE}/sitemap.xml` };
}
