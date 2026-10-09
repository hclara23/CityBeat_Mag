import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { coverStory, coverStoryCopy } from './cover-story'

test('cover story preserves the full print feature and labels historical details', () => {
  assert.equal(coverStory.sections.length, 8)
  const text = coverStory.sections.flatMap(section => section.paragraphs).join(' ')
  assert.ok(text.startsWith('EL PASO, Texas — Beatriz Fitzmaurice'))
  assert.ok(text.includes('She is a patient who is treated like someone special.'))
  assert.ok(text.includes('Cynthia Nayely Martinez Torres'))
  assert.ok(text.includes('Beginning in January 2027'))
  assert.ok(coverStoryCopy('en').archive.includes('Nayeli is no longer'))
  assert.ok(coverStoryCopy('es').archive.includes('Nayeli ya no'))
  assert.equal(coverStoryCopy('en').issue, 'October–November issue')
  assert.equal(coverStoryCopy('es').original, 'Reportaje original en inglés')
})

test('cover and original PDF ship with the linked article route', () => {
  for (const asset of [coverStory.cover, coverStory.pdf]) {
    assert.ok(existsSync(fileURLToPath(new URL(`../../public${asset}`, import.meta.url))))
  }
  const pdf = readFileSync(new URL(`../../public${coverStory.pdf}`, import.meta.url))
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
  assert.ok(existsSync(fileURLToPath(new URL(`../app/[locale]${coverStory.path}/page.tsx`, import.meta.url))))
})
