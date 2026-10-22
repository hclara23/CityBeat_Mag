import { pathToFileURL } from 'node:url';

// Retry only a read-only page while a newly created revision starts. The full
// smoke suite still runs afterward and keeps its existing assertions.
export async function waitForCandidate(origin, {
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = console.log,
  attempts = 6,
  timeoutMs = 30_000,
  delayMs = 5_000,
} = {}) {
  const url = new URL('/en', origin);
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(timeoutMs), redirect: 'manual',
      });
      await response.body?.cancel();
      log(`Candidate readiness ${attempt}/${attempts}: HTTP ${response.status}`);
      if (response.status === 200) return;
    } catch (error) {
      log(`Candidate readiness ${attempt}/${attempts}: ${error.message}`);
    }
    if (attempt < attempts) await sleep(delayMs);
  }
  throw new Error(`Candidate did not become ready after ${attempts} attempts`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  waitForCandidate(process.argv[2]).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
