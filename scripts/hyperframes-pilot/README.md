# Local CityBeat promotion template

Reusable 12-second, silent, captioned HyperFrames composition. Supports 1080×1920 portrait and 1920×1080 landscape. It contains three beats: business/locality, supplied services, and a QR/contact call to action. All display text is escaped, localities use the directory's canonical eleven-city list, and QR links point to the public CityBeat directory. Inputs are never fetched or published.

The example is synthetic and visibly marked **DRAFT · NOT PUBLISHED**. It is not a real client's advertisement. Confirm every service, contact detail and publication right before preparing a real campaign. Removing the draft label is an explicit input change; rendering does not authorize posting.

## Isolated setup

From the repository root, create the local tool environment, then install only inside it:

```powershell
python -m venv .tmp/hyperframes-runtime
npm install --prefix .tmp/hyperframes-runtime --no-audit --no-fund --ignore-scripts hyperframes@0.8.223 gsap@3.12.5
```

The application's existing `qrcode` dependency is used by the template builder. GSAP's original license/header is preserved in the copied runtime file. HyperFrames and GSAP are local tooling, not production application dependencies.

## Build, validate and render

```powershell
node scripts/hyperframes-pilot/template.mjs scripts/hyperframes-pilot/example.json .tmp/citybeat-hyperframes-demo
$env:HYPERFRAMES_NO_TELEMETRY='1'
$env:PUPPETEER_CACHE_DIR="$PWD/.tmp/hyperframes-browser-cache"
$env:HYPERFRAMES_EXTRACT_CACHE_DIR="$PWD/.tmp/hyperframes-frame-cache"
node .tmp/hyperframes-runtime/node_modules/hyperframes/bin/hyperframes.mjs lint .tmp/citybeat-hyperframes-demo
node .tmp/hyperframes-runtime/node_modules/hyperframes/bin/hyperframes.mjs render .tmp/citybeat-hyperframes-demo --output "$PWD/.tmp/citybeat-hyperframes-demo/preview.mp4" --fps 30 --quality delivery --workers 1 --no-browser-gpu
node --test scripts/hyperframes-pilot/template.test.mjs
```

Set `format` to `landscape` for the horizontal layout. Use up to four short, confirmed service names. The builder accepts repository-local JSON inputs and writes only beneath `.tmp`. Composition assets are self-contained after generation; no hosted AI, voice, video API or new server is required. `.tmp` and this pilot directory are excluded from cloud and container uploads.

## Postiz handoff

The app's Social image queue contains a separate Local business promotion workbench. Local drafts are usable without a Postiz account. Its initial scheduling pilot supports connected Facebook pages and text/link posts. Rendered video can be reviewed locally and uploaded through an authorized social tool separately; this release does not pretend to automate video upload or authorize a connected social account.

Configure a pre-existing, approved Postiz account using the server-only `POSTIZ_API_KEY`; `POSTIZ_API_URL` defaults to `https://api.postiz.com/public/v1`, or can name an approved HTTPS self-hosted `/public/v1` endpoint. Do not create paid hosting or an account subscription without approval. Scheduling requires explicit approval in the app, a confirmed channel, and a time 5 minutes–90 days ahead. An uncertain response is never retried automatically. Accepted scheduling is not proof of final publication; verify delivery in Postiz.
