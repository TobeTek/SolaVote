import { useValidatedBody, z } from 'h3-zod'

// XXX: A lot of insecure stuff is happening here
// We should instead be using wallet message signing and recovering.
// We? Yes, we. :)
export default eventHandler(async (event) => {
  const { walletAddress } = await useValidatedBody(event, {
    walletAddress: z.string().min(1).max(100),
  })
  const user = {
    login: 'wallet',
    address: walletAddress,
  }
  await setUserSession(event, { user })

  return sendRedirect(event, '/')
})
