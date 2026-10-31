// Local visual testing only. Keep its compiler output separate from other dev servers.
const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')
const envPath = path.resolve(__dirname, '../../../apps/web/.env.local')
if (fs.existsSync(envPath)) for (const match of fs.readFileSync(envPath, 'utf8').matchAll(/^([A-Z][A-Z0-9_]*)=/gm)) {
  if (!match[1].startsWith('NEXT_PUBLIC_')) process.env[match[1]] = ''
}
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8765'
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:8766'
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo-citybeat'
process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify({ project_id: 'demo-citybeat', client_email: 'fixture@demo-citybeat.iam.gserviceaccount.com',
  private_key: crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }) })
const config = require(path.resolve(__dirname, '../../../apps/web/next.config.js'))
config.distDir = process.env.CITYBEAT_PORTFOLIO_BUILD === '1' ? '.next/portfolio-build' : '.next/portfolio-preview'
