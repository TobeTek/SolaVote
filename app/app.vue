<script setup lang="ts">
import type { DropdownMenuItem } from '#ui/types'
import { SolanaAdapter } from '@reown/appkit-adapter-solana'
import { useAppKitConnection, type Provider } from '@reown/appkit-adapter-solana/vue'
import { solana, solanaDevnet, solanaTestnet } from '@reown/appkit/networks'
import { createAppKit, useAppKitAccount, useAppKitProvider } from '@reown/appkit/vue'
import { computed, watch } from 'vue'


const appKitAccount = useAppKitAccount({ namespace: 'solana' })
const { connection } = useAppKitConnection()
const { walletProvider } = useAppKitProvider<Provider>('solana')

// function handleWalletButtonClick() {
//   if (!!address) {
//     openAccountModal()
//   } else {
//     openConnectModal()
//   }
// }

// function openConnectModal() {
//   open({ view: 'Connect' })
// }

// function openAccountModal() {
//   open({ view: 'Account' })
// }

const config = useRuntimeConfig()
const projectId = config.public.projectId
const metadata = {
  name: 'SolaVote',
  description: 'Blockchain-powered voting platform',
  url: 'https://solavote.example',
  icons: ['https://avatars.githubusercontent.com/u/179229932'],
}
const solanaWeb3JsAdapter = new SolanaAdapter()
createAppKit({
  adapters: [solanaWeb3JsAdapter],
  metadata,
  networks: [solana, solanaTestnet, solanaDevnet],
  projectId,
})

const { loggedIn, user, clear } = useUserSession()
const colorMode = useColorMode()
watch(loggedIn, (isLoggedIn) => {
  if (!isLoggedIn) navigateTo('/')
})

const isDarkMode = computed({
  get: () => colorMode.preference === 'dark',
  set: (v) => (colorMode.preference = v ? 'dark' : 'light'),
})

const userSession = useUserSession()
// watch(address, async (newAddress) => {
//   if (!newAddress || address.value === newAddress) {
//     return
//   }
//   await $fetch('/api/auth/wallet', {
//     method: 'POST',
//     body: {
//       walletAddress: newAddress,
//     },
//   })
// })

useHead({
  htmlAttrs: { lang: 'en' },
  link: [
    { rel: 'icon', href: '/icon.png' },
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;700&display=swap',
    },
  ],
})

const items = [
  [
    {
      label: 'Logout',
      icon: 'i-lucide-log-out',
      onSelect: clear,
    },
  ],
] satisfies DropdownMenuItem[][]
</script>

<template>
  <UApp class="bg-gradient-to-br from-[#0A243A] to-[#1E88A8] text-white min-h-screen font-manrope">
    <!-- Textured background overlay -->
    <div class="fixed inset-0 bg-noise opacity-35 pointer-events-none"></div>

    <UContainer class="w-fit max-w-screen min-h-screen flex flex-col my-4">
      <header
        class="mx-auto w-fit flex justify-between items-center mb-6 px-4 py-2 border-b border-[#1A3A47] bg-[#0A243A]/80 backdrop-blur-lg rounded-sm"
      >
        <NuxtLink
          to="/"
          class="text-4xl font-bold bg-gradient-to-r from-[#6BA392] to-[#1E88A8] bg-clip-text text-transparent"
          style="letter-spacing: -1px; padding-right: 10px"
        >
          <i>SolaVote</i>
        </NuxtLink>
        <div class="flex items-center space-x-3">
          <client-only>
            <appkit-button />
          </client-only>
          <UButton
            class="px-8 py-4 bg-gradient-to-r from-[#6EE7B7] to-[#3B82F6] text-white text-nowrap font-bold rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
            icon="i-lucide-list"
            to="/admin-elections"
            v-if="appKitAccount?.address"
          >
            My Elections
          </UButton>
          <UButton
            class="px-8 py-4 bg-gradient-to-r from-[#6EE7B7] to-[#3B82F6] text-white text-nowrap font-bold rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
            icon="i-lucide-newspaper"
            to="/vote-election"
            v-if="appKitAccount?.address"
          >
            Vote
          </UButton>
          <!-- <UButton
            v-if="!loggedIn"
            to="/api/auth/github"
            icon="i-simple-icons-github"
            label="Login with GitHub"
            color="neutral"
            external
            class="font-medium text-lg"
          /> -->
          <div v-else class="flex items-center space-x-4">
            <UDropdownMenu v-if="user" :items="items">
              <UButton
                color="neutral"
                variant="ghost"
                trailing-icon="i-lucide-chevron-down"
                class="flex items-center space-x-2 font-medium text-lg"
              >
                <UAvatar :src="`https://github.com/${user.login}.png`" alt="Avatar" size="3xs" />
                <span>{{ user.login }}</span>
              </UButton>
            </UDropdownMenu>
          </div>
        </div>
      </header>

      <NuxtPage v-if="appKitAccount?.address"/>
      <div v-else>Kindly connect your wallet! :)</div>

      <footer class="mt-auto py-4 text-center text-[#6BA392] text-sm select-none">
        © 2025 SolaVote — built with ❤️ by TobeTek
      </footer>
    </UContainer>
  </UApp>
</template>

<style>
/* Global styles and animations */
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;700&display=swap');

body,
html {
  scroll-behavior: smooth;
  font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
}

.bg-noise {
  background-image: url('/background.png');
  background-size: cover;
}

.font-manrope {
  font-family: 'Manrope', sans-serif;
}
</style>
