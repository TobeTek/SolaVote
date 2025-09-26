import { Address, address, getAddressFromPublicKey, generateKeyPair } from '@solana/kit'
import { getAddressEncoder } from '@solana/addresses'

export function getAddressBytes(address: Address<string>) {
  const addressEncoder = getAddressEncoder()
  return addressEncoder.encode(address)
}
