import type { MetadataRoute } from 'next'

const escapeXml = (value: string) => value.replace(/[<>&"']/g, char => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
}[char]!))

export function serializeSitemap(entries: MetadataRoute.Sitemap): string {
  const urls = [...new Map(entries.map(entry => [entry.url, entry])).values()]
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' +
    urls.map(entry => '<url><loc>' + escapeXml(entry.url) + '</loc>' +
      (entry.lastModified ? '<lastmod>' + escapeXml(entry.lastModified instanceof Date ? entry.lastModified.toISOString() : entry.lastModified) + '</lastmod>' : '') +
      Object.entries(entry.alternates?.languages || {}).map(([lang, url]) =>
        `<xhtml:link rel="alternate" hreflang="${escapeXml(lang)}" href="${escapeXml(String(url))}"/>`).join('') +
      '</url>').join('') + '</urlset>'
}
