import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitForCandidate } from './wait-for-candidate.mjs';

test('candidate readiness recovers from timeout and unavailable responses', async () => {
  let calls = 0;
  let sleeps = 0;
  await waitForCandidate('https://candidate.example', {
    fetchImpl: async (url, options) => {
      assert.equal(url.pathname, '/en');
      assert.equal(options.redirect, 'manual');
      assert.ok(options.signal instanceof AbortSignal);
      calls++;
      if (calls === 1) throw new Error('timeout');
      return new Response(null, { status: calls === 2 ? 503 : 200 });
    },
    sleep: async () => { sleeps++; }, log: () => {},
  });
  assert.equal(calls, 3);
  assert.equal(sleeps, 2);
});

test('candidate readiness fails after bounded retries without accepting redirects', async () => {
  let calls = 0;
  let sleeps = 0;
  await assert.rejects(waitForCandidate('https://candidate.example', {
    fetchImpl: async () => { calls++; return new Response(null, { status: 302 }); },
    sleep: async () => { sleeps++; }, log: () => {}, attempts: 3,
  }), /did not become ready after 3 attempts/);
  assert.equal(calls, 3);
  assert.equal(sleeps, 2);
});
