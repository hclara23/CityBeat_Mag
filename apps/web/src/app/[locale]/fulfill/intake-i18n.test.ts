import { test } from 'node:test'
import assert from 'node:assert/strict'
// Relative rather than '@/lib/...' so the file runs under `npx tsx --test`
// without depending on tsconfig path resolution.
import { getSalesIntakeSchema, type IntakeSchema } from '../../../lib/sales-intake'
import { INTAKE_ES, localizeIntakeSchema } from './intake-i18n'

const KINDS = [
  'directory',
  'newsletter_sponsorship',
  'sponsored_story',
  'category_banner',
  'social_promotion',
  'event',
  'job',
  'custom',
] as const

function schemaFor(kind: string): IntakeSchema {
  const schema = getSalesIntakeSchema(kind)
  assert.ok(schema, `no intake schema for ${kind}`)
  return schema
}

// Every human-visible string in the schema, in the order the wizard shows them.
function visibleStrings(schema: IntakeSchema): string[] {
  const out = [schema.title, schema.completionLabel]
  for (const section of schema.sections) {
    out.push(section.eyebrow, section.title, section.description)
    for (const field of section.fields) {
      out.push(field.label)
      if (field.placeholder) out.push(field.placeholder)
      if (field.help) out.push(field.help)
      for (const option of field.options || []) out.push(option.label)
    }
  }
  return out
}

test('every string a paying customer can read has Spanish copy', () => {
  // The regression: a Spanish buyer is emailed an /es/fulfill link on purpose,
  // so ANY field added to lib/sales-intake.ts without Spanish here re-creates
  // the original bug (a paid order that cannot be completed) one field at a
  // time. This fails the moment that happens.
  const missing: string[] = []
  for (const kind of KINDS) {
    for (const value of visibleStrings(schemaFor(kind))) {
      if (!INTAKE_ES[value]) missing.push(`${kind}: ${value}`)
    }
  }
  assert.deepEqual(missing, [])
})

test('Spanish rendering never changes what gets submitted', () => {
  // The money invariant: the server sanitizer (sanitizeSalesIntakeValues) keeps
  // only values whose field id it knows and, for a select, only an exact option
  // VALUE. Translating either would silently drop the customer's answers while
  // the form still looked filled in.
  for (const kind of KINDS) {
    const en = schemaFor(kind)
    const es = localizeIntakeSchema(en, 'es')
    assert.equal(es.sections.length, en.sections.length)
    en.sections.forEach((section, s) => {
      assert.equal(es.sections[s].id, section.id)
      assert.equal(es.sections[s].fields.length, section.fields.length)
      section.fields.forEach((field, f) => {
        const translated = es.sections[s].fields[f]
        assert.equal(translated.id, field.id)
        assert.equal(translated.type, field.type)
        assert.equal(translated.required, field.required)
        assert.equal(translated.maxLength, field.maxLength)
        assert.deepEqual(
          (translated.options || []).map((o) => o.value),
          (field.options || []).map((o) => o.value)
        )
      })
    })
  }
})

test('Spanish rendering actually replaces the English copy', () => {
  const es = localizeIntakeSchema(schemaFor('directory'), 'es')
  assert.equal(es.title, 'Crea la ficha de tu negocio')
  assert.equal(es.sections[0].fields[0].label, 'Nombre público del negocio')
  assert.equal(es.completionLabel, 'Enviar ficha a revisión')
})

test('English is returned untouched, and unknown copy falls back to English', () => {
  const en = schemaFor('job')
  assert.equal(localizeIntakeSchema(en, 'en'), en)

  // An untranslated string must still render as English — an unlabelled field
  // is worse than a half-translated one.
  const invented: IntakeSchema = {
    title: 'A brand new brief',
    completionLabel: 'Send it',
    sections: [
      {
        id: 'x',
        eyebrow: 'Step 1',
        title: 'Untranslated section',
        description: 'No Spanish for this yet.',
        fields: [{ id: 'x1', label: 'Untranslated field', type: 'text', placeholder: 'Nothing here either' }],
      },
    ],
  }
  const out = localizeIntakeSchema(invented, 'es')
  assert.equal(out.title, 'A brand new brief')
  assert.equal(out.sections[0].eyebrow, 'Paso 1') // the parts we do know still translate
  assert.equal(out.sections[0].fields[0].label, 'Untranslated field')
  assert.equal(out.sections[0].fields[0].placeholder, 'Nothing here either')
})
