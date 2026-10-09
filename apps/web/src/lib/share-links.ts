export function socialShareLinks(url: string, title: string) {
  const enc = encodeURIComponent
  return [
    { name: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { name: 'x', label: 'X', href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}` },
    { name: 'linkedin', label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
    { name: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${enc(`${title} ${url}`)}` },
  ]
}
