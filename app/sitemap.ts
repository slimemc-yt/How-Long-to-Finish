import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://howlongtofinish.vercel.app', // CHANGE THIS to your real URL
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ]
}