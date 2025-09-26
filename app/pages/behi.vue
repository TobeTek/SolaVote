<template>
  <div class="flex flex-col gap-4">
    <client-only>
    <appkit-button />
    <div>{{ address }} | {{ connection }} | {{ walletProvider }}</div>
    </client-only>
    <USeperator />
    <p class="font-medium">Welcome to Atidone.</p>
    <p>
      A
      <a href="https://nuxt.com" target="_blank" class="text-(--ui-primary)" rel="noopener">Nuxt</a>
      demo hosted on
      <a
        href="https://pages.cloudflare.com"
        target="_blank"
        rel="noopener"
        class="text-(--ui-primary)"
        >Cloudflare Pages</a
      >
      with server-side rendering on the edge and using
      <NuxtLink
        href="https://developers.cloudflare.com/d1/"
        target="_blank"
        rel="noopener"
        class="text-(--ui-primary)"
      >
        Cloudflare D1 database </NuxtLink
      >.
    </p>
    <p>
      It is made using
      <a href="https://hub.nuxt.com" class="text-(--ui-primary)">NuxtHub</a> for a zero-config
      development & deployment experience on Cloudflare.
    </p>
    <USeparator />
    <p class="text-sm text-(--ui-text-muted) italic">
      No personal information regarding your GitHub account are stored in database.<br />
      We store only the todos created linked with your GitHub ID.
    </p>
  </div>
</template>

<script setup lang="ts">
import { useAppKitConnection, type Provider } from '@reown/appkit-adapter-solana/vue'
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/vue'
import { watch } from 'vue'
// import { useAppKit } from '@reown/appkit-adapter-solana/vue'
const address = useAppKitAccount({ namespace: 'solana' })
const { connection } = useAppKitConnection()
const { walletProvider } = useAppKitProvider<Provider>('solana')

// const { open } = useAppKit();

// function openModal() {
//   open();
// }

// function openConnectModal() {
//   open({ view: 'Connect' });
// }

// function openAccountModal() {
//   open({ view: 'Account' });
// }

watch(address, (newAddress) => {
  console.log('address updated:', newAddress)
})

watch(walletProvider, (newProvider) => {
  console.log('Provider updated:', newProvider)
})
</script>
