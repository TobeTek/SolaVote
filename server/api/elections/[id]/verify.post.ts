import { defineEventHandler } from 'h3'
export default defineEventHandler(async (event) => {
  // Parse form data
  const formData = await readFormData(event)
  const idCardFile = formData.get('idCard') as File
  const electionId = formData.get('electionId') as File

  if (!idCardFile || !electionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields: idCard or electionId',
    })
  }

  ensureBlob(idCardFile, {
    maxSize: '8MB',
    types: ['image'],
  })

  // Convert file to base64
  const fileBuffer = Buffer.from(await idCardFile.arrayBuffer())
  //   const base64Image = fileBuffer.toString('base64')

  // Use LLaVA model to analyze the ID card
  const response = await hubAI().run('@cf/llava-hf/llava-1.5-7b-hf', {
    image: [...new Uint8Array(fileBuffer)],
    prompt: `
        Analyze this ID card and determine if it's a valid student ID. Provide the following information:

        1. Is this a student ID card? (yes/no)
        2. What institution does it belong to? (if identifiable)
        3. What is the student's name? (if visible)
        4. What is the student ID number? (if visible)
        5. Does it have a photo of the student? (yes/no)
        6. Does it have an expiration date? (yes/no)
        7. Does it have any security features like holograms? (yes/no)
        8. Overall probability that this is a valid student ID (0-100%)

        Provide your analysis in strictly JSON format with these exact keys:
        {
          "isStudentID": boolean,
          "institution": string,
          "studentName": string,
          "studentID": string,
          "hasPhoto": boolean,
          "hasExpiration": boolean,
          "hasSecurityFeatures": boolean,
          "validityProbability": number,
          "reasoning": string
        }
      `,
  })

  // Parse the response (assuming it returns valid JSON)
  let analysis
  try {
    // Try to parse as JSON first
    analysis = JSON.parse(response.description)
  } catch (e) {
    // If not JSON, try to extract from text
    const textResponse = response.description
    analysis = {
      isStudentID:
        textResponse.includes('"isStudentID": true') || textResponse.includes('isStudentID: true'),
      institution: extractValue(textResponse, 'institution'),
      studentName: extractValue(textResponse, 'studentName'),
      studentID: extractValue(textResponse, 'studentID'),
      hasPhoto:
        textResponse.includes('"hasPhoto": true') || textResponse.includes('hasPhoto: true'),
      hasExpiration:
        textResponse.includes('"hasExpiration": true') ||
        textResponse.includes('hasExpiration: true'),
      hasSecurityFeatures:
        textResponse.includes('"hasSecurityFeatures": true') ||
        textResponse.includes('hasSecurityFeatures: true'),
      validityProbability: extractProbability(textResponse),
      reasoning: extractReasoning(textResponse),
    }
  }

  // Validate the election exists (optional)
  // const election = await $fetch(`/api/elections/${electionId}`)
  // if (!election) {
  //   throw createError({
  //     statusCode: 404,
  //     statusMessage: 'Election not found',
  //   })
  // }

  // Return the analysis with approval decision
  const approved = analysis.validityProbability > 70 // Threshold for approval

  return {
    approved,
    analysis,
    message: approved
      ? 'ID card verified successfully'
      : 'ID card verification failed - does not appear to be a valid student ID',
  }
})

// Helper functions to extract data from text response
function extractValue(text: string, key: string): string {
  const regex = new RegExp(`"${key}":\\s*"([^"]+)"`, 'i')
  const match = text.match(regex)
  return match ? match[1] : 'Not identified'
}

function extractProbability(text: string): number {
  const regex = /(\d{1,3})%/i
  const match = text.match(regex)
  return match ? parseInt(match[1]) : 50
}

function extractReasoning(text: string): string {
  const reasoningMatch = text.match(/reasoning":\s*"([^"]+)"/i)
  if (reasoningMatch) return reasoningMatch[1]

  // Fallback to look for any explanation text
  const explanationMatch = text.match(/because|since|as|reason[:\s]/i)
  if (explanationMatch) {
    return text.substring(explanationMatch.index || 0).split('\n')[0]
  }

  return 'Analysis completed'
}
