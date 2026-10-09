import assert from 'node:assert/strict'
import { test } from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import story from './machelle-story.json'

test('Machelle profile preserves the complete four-section issue story', () => {
  assert.equal(story.title, 'From Guest Book to Historic Home')
  assert.equal(story.sections.length, 4)
  const paragraphs = story.sections.flatMap(section => section.paragraphs)
  assert.equal(paragraphs.length, 26)
  assert.equal(paragraphs[0], "Machelle Wood almost didn't have an art show.")
  assert.ok(paragraphs.at(-1)?.includes('share my passion for history every day.'))
  assert.ok(!JSON.stringify(story).includes('[Writer Name]'))
})

test('Machelle assets and route ship; Premier remains the homepage cover', () => {
  for (const image of ['machelle-wood-speaking.webp', 'machelle-wood-archives.webp']) {
    assert.ok(existsSync(new URL(`../../public/print/${image}`, import.meta.url)))
  }
  assert.ok(existsSync(new URL(`../app/[locale]/stories/${story.slug}/page.tsx`, import.meta.url)))
  const home = readFileSync(new URL('../app/[locale]/page.tsx', import.meta.url), 'utf8')
  assert.ok(home.indexOf('<CoverStoryFeature') < home.indexOf('<MachelleStoryCard'))
  const index = readFileSync(new URL('../app/[locale]/stories/page.tsx', import.meta.url), 'utf8')
  assert.ok(index.includes("!selected || selected === 'culture'"))
})
