import { address, getAddressFromPublicKey, generateKeyPair } from '@solana/kit'
import { getAddressEncoder, type Address } from '@solana/addresses'

export function getAddressBytes(address: Address<string>) {
  const addressEncoder = getAddressEncoder()
  return addressEncoder.encode(address)
}
