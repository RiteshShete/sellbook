// Makes a VAPID key pair for web push. Run it yourself and keep the output: it is NOT saved anywhere.
//   node scripts/gen-vapid.mjs
// Public key  -> repository variable / .env.local  VITE_VAPID_PUBLIC_KEY, and the function secret VAPID_PUBLIC_KEY
// Private key -> ONLY the function secret VAPID_PRIVATE_KEY (supabase secrets set ...). Never commit it.
import { generateKeyPairSync } from 'node:crypto'

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const pub = publicKey.export({ format: 'jwk' })
const prv = privateKey.export({ format: 'jwk' })
const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')])
console.log(`VAPID_PUBLIC_KEY=${raw.toString('base64url')}`)
console.log(`VAPID_PRIVATE_KEY=${prv.d}`)
