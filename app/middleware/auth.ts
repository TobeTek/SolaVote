import { useAppKitAccount } from '@reown/appkit/vue'

export default defineNuxtRouteMiddleware(async () => {
  // const { address } = useAppKitAccount({ namespace: 'solana' }).value
  // const { loggedIn } = useUserSession()

  // if (!!address && !loggedIn) {
  //   await $fetch('/api/auth/wallet', {
  //     method: 'POST',
  //     body: {
  //       walletAddress: address,
  //     },
  //   })
  // }

  // if (!loggedIn.value) {
  //   return navigateTo('/')
  // }
})
