import { z, useValidatedBody, } from 'h3-zod'
import { createError } from 'h3'

const schema = z.object({
  file: z.any() // Accept any, then validate server-side
})

export default eventHandler(async (event) => {
  // Parse FormData from the request
  const formData = await readFormData(event)

  const file = formData.get('file') as File;

  const filename = `${Date.now()}-${file.name || 'upload'}`


  if (!file || !file.size) {
    throw createError({ statusCode: 400, message: 'No file provided' })
  }

  ensureBlob(file, {
    maxSize: '8MB',
    types: ['image']
  })

  return hubBlob().put(filename, file, {
    addRandomSuffix: false,
    prefix: 'images'
  })
})
