import { webcrypto as crypto } from 'node:crypto';

/**
 * Family codes are the entire security model — there are no accounts. A code is
 * effectively a capability: whoever holds it has full read/write on the family.
 */

/** Crockford-style: no 0/O, 1/I/L, or U (which also avoids accidental words). */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const RADIX = ALPHABET.length; // 30
const LENGTH = 12; // 30^12 ≈ 2^59

/** Largest multiple of 30 below 256; bytes at or above it are rejected so the
 *  modulo below stays uniform rather than biasing toward early letters. */
const REJECT_AT = 240;

export function generateFamilyCode(): string {
  let out = '';
  const buf = new Uint8Array(64);
  while (out.length < LENGTH) {
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (out.length === LENGTH) break;
      if (b < REJECT_AT) out += ALPHABET[b % RADIX];
    }
  }
  return out;
}

/** Strip formatting so hyphens, spaces and case never matter on input. */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^23456789ABCDEFGHJKMNPQRSTVWXYZ]/g, '');
}

/** "XKM79QRD3FTW" → "XKM7-9QRD-3FTW" for display and reading aloud. */
export function formatCode(code: string): string {
  const n = normalizeCode(code);
  return n.match(/.{1,4}/g)?.join('-') ?? n;
}

export function isPlausibleCode(raw: string): boolean {
  return normalizeCode(raw).length === LENGTH;
}

/**
 * The blob key is a hash of the code, never the code itself.
 *
 * Blob keys are visible in the Netlify UI, through the Blobs API, and in any
 * list() call. If the key *were* the code, anyone who could list the store
 * would own every family. The pepper additionally defeats offline brute-force
 * against a leaked key listing — 2^59 is unguessable online, but it is not out
 * of reach for offline SHA-256 cracking.
 */
export async function codeToKey(code: string): Promise<string> {
  const pepper = process.env.FAMILY_CODE_PEPPER;
  if (!pepper) {
    throw new Error(
      'FAMILY_CODE_PEPPER is not set. Refusing to derive blob keys without it — ' +
        'see .env.example.',
    );
  }
  const data = new TextEncoder().encode(`kin:v1:${pepper}:${normalizeCode(code)}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `family/${hex}`;
}
