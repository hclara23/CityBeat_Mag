import { createHmac, randomBytes } from 'crypto'
import QRCode from 'qrcode'

// Self-contained RFC 6238 TOTP (SHA-1, 6 digits, 30s step) — no external OTP
// dependency, so there's nothing to break on version/ESM churn.

const ISSUER = 'CityBeat'
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const b of buf) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/g, '').toUpperCase().replace(/\s/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const c of clean) {
    const idx = B32.indexOf(c)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

function hotp(key: Buffer, counter: number): string {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac('sha1', key).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return (code % 1_000_000).toString().padStart(6, '0')
}

export function generateMfaSecret(): string {
  return base32Encode(randomBytes(20))
}

export async function buildMfaEnrollment(email: string, secret: string) {
  const label = encodeURIComponent(`${ISSUER}:${email}`)
  const otpauth = `otpauth://totp/${label}?secret=${secret}&issuer=${ISSUER}&algorithm=SHA1&digits=6&period=30`
  const qrDataUrl = await QRCode.toDataURL(otpauth, { margin: 1, width: 240 })
  return { otpauth, qrDataUrl, secret }
}

// Verifies a 6-digit code, tolerating ±1 time-step (±30s) of clock skew.
export function verifyTotp(secret: string, token: string): boolean {
  if (!secret || !token) return false
  const clean = String(token).replace(/\s/g, '')
  if (!/^\d{6}$/.test(clean)) return false
  const key = base32Decode(secret)
  const counter = Math.floor(Date.now() / 1000 / 30)
  for (let w = -1; w <= 1; w++) {
    if (hotp(key, counter + w) === clean) return true
  }
  return false
}
