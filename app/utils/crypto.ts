// utils/crypto.ts
import { encrypt, decrypt, type EthEncryptedData } from '@metamask/eth-sig-util'

export function encryptVote(
  voteData: string,
  publicKey: string
): { ciphertext: string; nonce: string; version: string } {
  return encrypt({
    publicKey,
    data: voteData,
    version: 'x25519-xsalsa20-poly1305',
  })
}

export function decryptVote(
  encryptedData: EthEncryptedData,
  privateKey: string
): string {
  return decrypt({
    encryptedData,
    privateKey,
  })
}
