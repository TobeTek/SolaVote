// utils/crypto.ts
import { encrypt } from '@metamask/eth-sig-util'

export function encryptVote(voteData: string, publicKey: string): string {
  return encrypt({
    publicKey,
    data: voteData,
    version: 'x25519-xsalsa20-poly1305',
  }).ciphertext
}
