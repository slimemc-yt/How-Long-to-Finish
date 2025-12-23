import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: 'https://howlongtofinish.vercel.app/sitemap.xml', // CHANGE THIS too
  }
}