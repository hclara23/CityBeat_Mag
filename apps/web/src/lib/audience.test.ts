import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AUDIENCE_COLUMNS,
  audienceExportFilename,
  buildAudienceCsv,
  csvCell,
  emptyAudienceRow,
  isAudienceDataset,
  matchesAudienceSearch,
} from './audience'

test('dataset keys are validated', () => {
  assert.equal(isAudienceDataset('profiles'), true)
  assert.equal(isAudienceDataset('newsletter_active'), true)
  assert.equal(isAudienceDataset('drop_table'), false)
  assert.equal(isAudienceDataset(''), false)
})

test('CSV cells neutralize formula injection and escape', () => {
  assert.equal(csvCell('=cmd()'), "'=cmd()")
  assert.equal(csvCell('+1'), "'+1")
  assert.equal(csvCell('-1'), "'-1")
  assert.equal(csvCell('@x'), "'@x")
  assert.equal(csvCell('a,b'), '"a,b"')
  assert.equal(csvCell('he said "hi"'), '"he said ""hi"""')
  assert.equal(csvCell(null), '')
})

test('CSV starts with a UTF-8 BOM, a header row, and the exact allow-listed columns', () => {
  const row = { ...emptyAudienceRow(), name: 'Ann', email: 'a@b.com', plan: 'premium' }
  const csv = buildAudienceCsv([row])
  assert.ok(csv.startsWith('﻿'))
  const lines = csv.slice(1).split('\r\n')
  assert.equal(lines[0], AUDIENCE_COLUMNS.map((c) => c.header).join(','))
  assert.equal(lines.length, 2)
  assert.ok(lines[1].startsWith('Ann,a@b.com,'))
})

test('a formula-injection value in a real field is neutralized in the export', () => {
  const row = { ...emptyAudienceRow(), name: '=HYPERLINK("http://evil")' }
  const csv = buildAudienceCsv([row])
  assert.ok(csv.includes("'=HYPERLINK"))
  assert.ok(!/\n=HYPERLINK/.test(csv))
})

test('search matches name/email/business/id, case-insensitive', () => {
  const row = { ...emptyAudienceRow(), name: 'Taquería El Sol', email: 'sol@x.com', business_id: 'abc123' }
  assert.equal(matchesAudienceSearch(row, 'taqueria'.slice(0, 4)), true) // 'taqu'
  assert.equal(matchesAudienceSearch(row, 'SOL@'), true)
  assert.equal(matchesAudienceSearch(row, 'abc123'), true)
  assert.equal(matchesAudienceSearch(row, 'nope'), false)
  assert.equal(matchesAudienceSearch(row, ''), true)
})

test('export filename is sanitized and dated', () => {
  assert.equal(audienceExportFilename('profiles', '2026-07-31'), 'citybeat-profiles-2026-07-31.csv')
  assert.equal(audienceExportFilename('../etc/passwd', '2026-07-31'), 'citybeat-etcpasswd-2026-07-31.csv')
})
