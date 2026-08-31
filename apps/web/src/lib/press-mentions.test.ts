import { test } from 'node:test'
import assert from 'node:assert/strict'
import { articleContentToText, nameIsMatchable, textMentionsName } from './press-mentions'

test('name matchability filters out short/generic names', () => {
  // Multi-word business names are matchable.
  assert.equal(nameIsMatchable('Tacos El Rey'), true)
  assert.equal(nameIsMatchable('Chuco Coffee Co'), true)
  // Long single words are matchable; short single words are not (too generic
  // to phrase-match in prose without false positives).
  assert.equal(nameIsMatchable('Barrigas'), true)
  assert.equal(nameIsMatchable('Subway'), false)
  assert.equal(nameIsMatchable('Cafe'), false)
  assert.equal(nameIsMatchable(''), false)
  assert.equal(nameIsMatchable('  ab  '), false)
  // Bare region/place phrases would match every story — stoplisted.
  assert.equal(nameIsMatchable('El Paso'), false)
  assert.equal(nameIsMatchable('el paso'), false)
  assert.equal(nameIsMatchable('Ciudad Juárez'), false)
  assert.equal(nameIsMatchable('Las Cruces'), false)
  assert.equal(nameIsMatchable('Fort Bliss'), false)
  // ...but real names CONTAINING a region word stay matchable.
  assert.equal(nameIsMatchable('El Paso Electric Supply'), true)
})

test('mentions match whole phrases case-insensitively, not substrings', () => {
  const text = 'Owners of Tacos El Rey said the Downtown corridor is booming.'
  assert.equal(textMentionsName(text, 'Tacos El Rey'), true)
  assert.equal(textMentionsName(text, 'tacos el rey'), true)
  // Not present.
  assert.equal(textMentionsName(text, 'Tacos El Reyes'), false)
  // Substring inside a longer word must NOT match.
  assert.equal(textMentionsName('The Barrigasville festival', 'Barrigas'), false)
  // Punctuation boundaries are fine.
  assert.equal(textMentionsName('…at “Tacos El Rey,” a Lower Valley staple', 'Tacos El Rey'), true)
  // Regex metacharacters in names must not break matching.
  assert.equal(textMentionsName('Stop by Joe & Sons (Eastside) today', 'Joe & Sons (Eastside)'), true)
})

test('article content flattens from every stored shape', () => {
  // Plain markdown-ish string (auto-articles).
  assert.equal(articleContentToText('Para one.\n\nPara two.'), 'Para one.\n\nPara two.')
  // Flat block array (ingest/creator).
  const blocks = [
    { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'World' }] },
  ]
  const flat = articleContentToText(blocks)
  assert.ok(flat.includes('Hello') && flat.includes('World'))
  // Full TipTap doc.
  const doc = { type: 'doc', content: blocks }
  const docText = articleContentToText(doc)
  assert.ok(docText.includes('Hello') && docText.includes('World'))
  // Garbage is safe.
  assert.equal(articleContentToText(null), '')
  assert.equal(articleContentToText(42 as any), '')
})
