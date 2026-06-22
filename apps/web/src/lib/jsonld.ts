// Serializes an object for a <script type="application/ld+json"> block, escaping
// `<` so attacker-controlled values (e.g. a business name containing
// "</script>") can't break out of the script tag and inject markup.
export function jsonLdSafe(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
