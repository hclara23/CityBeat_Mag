export function ApartmentAreaContext({ locale, city = 'El Paso', state = 'TX' }: { locale: 'en' | 'es'; city?: string; state?: string }) {
  if (state !== 'TX' || !['El Paso', 'San Elizario'].includes(city)) return null
  const es = locale === 'es'
  const rows = es ? [
    ['Población estimada · julio de 2025', '877,858'],
    ['Hogares · 2020–2024', '299,637'],
    ['Ingreso mediano del hogar · dólares de 2024', '$59,806'],
    ['Viviendas ocupadas por inquilinos · 2020–2024', '35.8%'],
    ['Traslado promedio al trabajo · 2020–2024', '24.1 min'],
    ['Renta bruta mediana del condado · 2020–2024', '$1,079 / mes'],
  ] : [
    ['Estimated population · July 2025', '877,858'],
    ['Households · 2020–2024', '299,637'],
    ['Median household income · 2024 dollars', '$59,806'],
    ['Renter-occupied homes · 2020–2024', '35.8%'],
    ['Mean commute to work · 2020–2024', '24.1 min'],
    ['County median gross rent · 2020–2024', '$1,079 / month'],
  ]
  return <section className="mt-8 rounded-2xl border border-white/15 bg-brand-ink p-6 sm:p-8">
    <h2 className="text-xl font-bold">{es ? 'Contexto regional: condado de El Paso' : 'Regional context: El Paso County'}</h2>
    <p className="mt-3 text-sm leading-6 text-white/65">{es ? 'Estas estimaciones del Censo describen todo el condado, no este complejo ni sus residentes. La renta mediana del condado no es el precio anunciado de esta propiedad.' : 'These Census estimates describe the entire county, not this community or its residents. County median rent is not this property’s advertised price.'}</p>
    <dl className="mt-5 grid gap-4 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="rounded-lg border border-white/10 p-4"><dt className="text-xs text-white/60">{label}</dt><dd className="mt-2 text-xl font-black">{value}</dd></div>)}</dl>
    <p className="mt-4 text-xs leading-5 text-white/55">{es ? 'La proporción de inquilinos se calcula como 100% menos 64.2% de viviendas ocupadas por propietarios. Datos ACS 2020–2024, excepto población (V2025). Revisado: 2026-11-02.' : 'Renter share is calculated as 100% minus the 64.2% owner-occupied rate. ACS 2020–2024 except population (V2025). Checked: 2026-11-02.'}</p>
    <a href="https://www.census.gov/quickfacts/elpasocountytexas" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-brand-neon underline">U.S. Census Bureau · QuickFacts ↗</a>
  </section>
}
