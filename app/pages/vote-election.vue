<script setup lang="ts">
import { useAppKitAccount } from '@reown/appkit/vue'
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Fingerprint,
  Lock,
  Search,
  Upload,
  User,
  X
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { encryptVote } from '~/utils/crypto'

// Types
interface Election {
  id: string
  title: string
  creatorAddress: string
  startTime: string
  endTime: string
  isPrivate: boolean
  isActive: boolean
  publicKey: string
  idCardTemplate: string
  merkleRoot?: string
  candidates: Array<{
    name: string
    picture: string
    manifesto: string
  }>
}

// State
const elections = ref<Election[]>([])
const filteredElections = ref<Election[]>([])
const selectedElection = ref<Election | null>(null)
const isDragging = ref(false)
const idCardFile = ref<File | null>(null)
const idVerificationText = ref('')
const idVerificationStatus = ref<'idle' | 'loading' | 'approved' | 'rejected'>('idle')
const voteSubmissionStatus = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
const selectedCandidate = ref<string | null>(null)
const merkleProof = ref<string[] | null>(null)
const searchQuery = ref('')
const showPrivate = ref(true)
const showPublic = ref(true)
const currentPage = ref(1)
const itemsPerPage = 6

const appKitAccount = useAppKitAccount({ namespace: 'solana' })

// Computed
const timeRemaining = (endTime: string) => {
  const end = new Date(endTime)
  const now = new Date()
  const diff = end.getTime() - now.getTime()
  if (diff <= 0) return 'Closed'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  return `${days}d ${hours}h remaining`
}

const isElectionActive = (election: Election) => {
  const now = new Date()
  const start = new Date(election.startTime)
  const end = new Date(election.endTime)
  return election.isActive
}

const filteredAndPaginatedElections = computed(() => {
  let filtered = elections.value

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      (election) =>
        election.title.toLowerCase().includes(query) ||
        election.creatorAddress.toLowerCase().includes(query)
    )
  }

  // Apply privacy filters
  if (!showPrivate.value) {
    filtered = filtered.filter((election) => !election.isPrivate)
  }
  if (!showPublic.value) {
    filtered = filtered.filter((election) => election.isPrivate)
  }

  // Pagination
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filtered.slice(start, end)
})

const totalPages = computed(() => {
  let filtered = elections.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      (election) =>
        election.title.toLowerCase().includes(query) ||
        election.creatorAddress.toLowerCase().includes(query)
    )
  }

  if (!showPrivate.value) {
    filtered = filtered.filter((election) => !election.isPrivate)
  }
  if (!showPublic.value) {
    filtered = filtered.filter((election) => election.isPrivate)
  }

  return Math.ceil(filtered.length / itemsPerPage)
})

// Methods
const fetchElections = async () => {
  try {
    elections.value = await $fetch('/api/elections')
    filteredElections.value = [...elections.value]
  } catch (error) {
    console.error('Failed to fetch elections:', error)
  }
}

const fetchElectionDetails = async (id: string) => {
  try {
    selectedElection.value = await $fetch(`/api/elections/${id}`)
    if (selectedElection.value.isPrivate && appKitAccount.value?.address) {
      await fetchMerkleProof()
    }
  } catch (error) {
    console.error('Failed to fetch election details:', error)
  }
}

const fetchMerkleProof = async () => {
  if (!selectedElection.value?.isPrivate || !appKitAccount.value?.address) return

  try {
    idVerificationStatus.value = 'loading'
    const { proof } = await $fetch(`/api/elections/${selectedElection.value.id}/proof`, {
      method: 'POST',
      body: { address: appKitAccount.value?.address },
    })
    merkleProof.value = proof
    idVerificationStatus.value = 'idle'
  } catch (error) {
    console.error('Failed to fetch Merkle proof:', error)
    idVerificationStatus.value = 'rejected'
  }
}

const verifyIDCard = async () => {
  if (!idCardFile.value || !selectedElection.value) return
  idVerificationStatus.value = 'loading'
  idVerificationText.value = ''
  try {
    const formData = new FormData()
    formData.append('idCard', idCardFile.value)
    formData.append('electionId', selectedElection.value.id)

    const result = await $fetch(`/api/elections/${selectedElection.value.id}/verify`, {
      method: 'POST',
      body: formData,
    })

    idVerificationStatus.value = result.approved ? 'approved' : 'rejected'
    idVerificationText.value = result.analysis
  } catch (error) {
    console.error('ID verification failed:', error)
    idVerificationStatus.value = 'rejected'
  }
}

const submitVote = async () => {
  if (!selectedCandidate.value || !selectedElection.value || !appKitAccount.value?.address) return
  voteSubmissionStatus.value = 'loading'
  try {
    const encryptedVote = encryptVote(
      JSON.stringify({
        candidate: selectedCandidate.value,
        voter: appKitAccount.value?.address,
        timestamp: new Date().toISOString(),
      }),
      selectedElection.value.publicKey
    )

    const result = await $fetch('/api/votes', {
      method: 'POST',
      body: {
        electionId: selectedElection.value.id,
        encryptedVote,
        voterAddress: appKitAccount.value?.address,
        merkleProof: merkleProof.value,
      },
    })

    voteSubmissionStatus.value = 'success'
    setTimeout(() => {
      selectedElection.value = null
      voteSubmissionStatus.value = 'idle'
    }, 2000)
  } catch (error) {
    console.error('Vote submission failed:', error)
    voteSubmissionStatus.value = 'error'
  }
}

// Drag-and-drop handlers
const onDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = true
}
const onDragLeave = () => {
  isDragging.value = false
}
const onDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file && file.type.startsWith('image/')) {
    idCardFile.value = file
  }
}

// Pagination
const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

// Fetch elections on mount
onMounted(fetchElections)

// Watch for changes in filters
watch([searchQuery, showPrivate, showPublic], () => {
  currentPage.value = 1
})
</script>

<template>
  <div class="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-8">
    <!-- Election List View -->
    <div v-if="!selectedElection" class="mx-auto">
      <div class="flex flex-col justify-between items-center mb-8">
        <h1 class="text-3xl font-bold text-white mb-4 md:mb-0">Available Elections</h1>

        <div class="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div class="relative w-full md:w-64">
            <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search elections..."
              class="w-full pl-10 pr-4 py-2 bg-gray-800 rounded-md border border-gray-700 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 text-white"
            />
          </div>

          <div class="flex gap-2">
            <button
              @click="showPrivate = !showPrivate"
              class="flex items-center gap-1 px-3 py-2 bg-gray-800 rounded-md border border-gray-700 text-sm"
              :class="showPrivate ? 'text-blue-400 border-blue-400' : 'text-gray-400'"
            >
              <Lock class="h-4 w-4" />
              <span>Private</span>
            </button>
            <button
              @click="showPublic = !showPublic"
              class="flex items-center gap-1 px-3 py-2 bg-gray-800 rounded-md border border-gray-700 text-sm"
              :class="showPublic ? 'text-blue-400 border-blue-400' : 'text-gray-400'"
            >
              <span>Public</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Election Cards -->
      <div v-if="filteredAndPaginatedElections.length === 0" class="text-center py-12">
        <p class="text-gray-400">No elections match your filters</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div
          v-for="election in filteredAndPaginatedElections"
          :key="election.id"
          @click="fetchElectionDetails(election.id)"
          class="bg-gray-800 p-6 rounded-lg shadow-lg cursor-pointer hover:bg-gray-700 transition-colors border border-gray-700"
        >
          <div class="flex flex-col h-full">
            <div class="flex-1">
              <h2 class="text-xl font-semibold text-white mb-2">{{ election.title }}</h2>
              <div class="flex items-center gap-2 mt-2 text-sm text-gray-400">
                <Calendar class="h-4 w-4" />
                <span>{{ new Date(election.startTime).toLocaleDateString() }}</span>
              </div>
              <div class="flex items-center gap-2 mt-1 text-sm text-gray-400">
                <Clock class="h-4 w-4" />
                <span>{{ timeRemaining(election.endTime) }}</span>
              </div>
              <div class="flex items-center gap-2 mt-1 text-sm text-gray-400">
                <User class="h-4 w-4" />
                <span
                  >{{ election.creatorAddress.slice(0, 6) }}...{{
                    election.creatorAddress.slice(-4)
                  }}</span
                >
              </div>
            </div>

            <div class="mt-4 flex items-center justify-between">
              <div class="flex items-center gap-1 text-sm">
                <Lock v-if="election.isPrivate" class="h-4 w-4 text-red-400" />
                <span v-if="election.isPrivate" class="text-red-400">Private</span>
                <span v-else class="text-green-400">Public</span>
              </div>
              <span
                class="text-xs px-2 py-1 rounded-full"
                :class="
                  isElectionActive(election)
                    ? 'bg-green-900 text-green-400'
                    : 'bg-gray-700 text-gray-400'
                "
              >
                {{ isElectionActive(election) ? 'Active' : 'Inactive' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex justify-center items-center gap-4">
        <button
          @click="prevPage"
          :disabled="currentPage === 1"
          class="p-2 rounded-md bg-gray-800 text-gray-400 hover:text-white disabled:opacity-50"
        >
          <ChevronLeft class="h-5 w-5" />
        </button>
        <span class="text-gray-400">Page {{ currentPage }} of {{ totalPages }}</span>
        <button
          @click="nextPage"
          :disabled="currentPage === totalPages"
          class="p-2 rounded-md bg-gray-800 text-gray-400 hover:text-white disabled:opacity-50"
        >
          <ChevronRight class="h-5 w-5" />
        </button>
      </div>
    </div>

    <!-- Election Detail View -->
    <div v-else class="max-w-5xl mx-auto">
      <button
        @click="selectedElection = null"
        class="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft class="h-5 w-5" />
        <span>Back to Elections</span>
      </button>

      <div class="bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700 mb-8">
        <h1 class="text-3xl font-bold mb-6 text-white">{{ selectedElection.title }}</h1>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <p class="text-gray-300 mb-2">
              <span class="font-semibold">Creator:</span>
              {{ selectedElection.creatorAddress.slice(0, 6) }}...{{
                selectedElection.creatorAddress.slice(-4)
              }}
            </p>
            <p class="text-gray-300 mb-2">
              <span class="font-semibold">Status:</span>
              {{ timeRemaining(selectedElection.endTime) }}
            </p>
            <p class="text-gray-300">
              <span class="font-semibold">Type:</span>
              {{ selectedElection.isPrivate ? 'Private' : 'Public' }}
            </p>
          </div>
          <div>
            <p class="text-gray-300 mb-2">
              <span class="font-semibold">Start Time:</span>
              {{ new Date(selectedElection.startTime).toLocaleString() }}
            </p>
            <p class="text-gray-300 mb-2">
              <span class="font-semibold">End Time:</span>
              {{ new Date(selectedElection.endTime).toLocaleString() }}
            </p>
          </div>
        </div>
      </div>

      <!-- Public Key Display -->
      <div class="bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700 mb-8">
        <h2 class="text-xl font-bold mb-4 text-white">Vote Encryption</h2>
        <div class="bg-gray-700 p-4 rounded-md mb-4">
          <p class="text-sm text-gray-300 font-mono break-all">{{ selectedElection.publicKey }}</p>
        </div>
        <p class="text-sm text-gray-400">
          Your vote will be encrypted with this public key before submission to ensure privacy.
        </p>
      </div>

      <!-- Private Election Verification -->
      <div
        v-if="selectedElection.isPrivate"
        class="bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700 mb-8"
      >
        <h2 class="text-xl font-bold mb-6 text-white">Whitelist Verification</h2>

        <div
          v-if="!appKitAccount.value?.address"
          class="bg-yellow-900/30 border border-yellow-900 rounded-md p-4 mb-4"
        >
          <p class="text-yellow-400 text-center">
            Connect your wallet to verify your whitelist status for this private election.
          </p>
        </div>

        <div v-else>
          <div v-if="idVerificationStatus === 'loading'" class="text-center py-4">
            <p class="text-gray-400">Verifying your whitelist status...</p>
          </div>

          <div v-else>
            <div v-if="merkleProof" class="mb-4">
              <p class="text-sm text-gray-400 mb-2">Your whitelist verification:</p>
              <div class="flex items-center gap-2">
                <CheckCircle
                  v-if="idVerificationStatus === 'approved'"
                  class="h-5 w-5 text-green-400"
                />
                <X v-else class="h-5 w-5 text-red-400" />
                <span
                  :class="idVerificationStatus === 'approved' ? 'text-green-400' : 'text-red-400'"
                >
                  {{
                    idVerificationStatus === 'approved'
                      ? 'Verified: You are whitelisted!'
                      : 'Not verified'
                  }}
                  <br />
                  {{ idVerificationText }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Prominent Candidate Panel -->
      <div class="bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700 mb-8">
        <h2 class="text-2xl font-bold mb-6 text-white">Candidates</h2>

        <div
          v-if="!isElectionActive(selectedElection)"
          class="bg-yellow-900/30 border border-yellow-900 rounded-md p-4 mb-6"
        >
          <p class="text-yellow-400 text-center">
            This election is not currently active for voting.
          </p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div
            v-for="candidate in selectedElection.candidates"
            :key="candidate.name"
            @click="
              isElectionActive(selectedElection) ? (selectedCandidate = candidate.name) : null
            "
            class="relative p-6 rounded-lg border-2 transition-all"
            :class="[
              selectedCandidate === candidate.name && isElectionActive(selectedElection)
                ? 'border-blue-400 bg-gray-700/50 cursor-pointer'
                : 'border-gray-700 hover:border-gray-500 cursor-pointer',
              !isElectionActive(selectedElection) ? 'opacity-60 cursor-not-allowed' : '',
            ]"
          >
            <!-- Selection indicator -->
            <div
              v-if="selectedCandidate === candidate.name && isElectionActive(selectedElection)"
              class="absolute -top-3 -right-3 bg-blue-600 rounded-full p-2 shadow-lg"
            >
              <Fingerprint class="h-6 w-6 text-white" />
            </div>

            <div class="flex flex-col items-center text-center">
              <img
                :src="candidate.picture"
                alt="Candidate"
                class="h-24 w-24 rounded-full object-cover mb-4 border-4"
                :class="[
                  selectedCandidate === candidate.name && isElectionActive(selectedElection)
                    ? 'border-blue-400'
                    : 'border-gray-500',
                  !isElectionActive(selectedElection) ? 'opacity-50' : '',
                ]"
              />
              <h3 class="text-xl font-bold mb-2 text-white">{{ candidate.name }}</h3>
              <div class="bg-gray-700 p-4 rounded-lg w-full text-left">
                <p class="text-gray-300">{{ candidate.manifesto }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ID Verification Section -->
      <div class="bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700">
        <h2 class="text-xl font-bold mb-6 text-white">Verify Your ID</h2>

        <!-- ID Card Upload -->
        <div
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop"
          class="border-2 border-dashed rounded-lg p-12 text-center mb-6 transition-colors"
          :class="isDragging ? 'border-blue-400 bg-gray-700' : 'border-gray-600'"
        >
          <Upload class="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p class="text-gray-300">
            {{
              idCardFile
                ? `File ready: ${idCardFile.name}`
                : 'Drag and drop your ID card image here or click to upload'
            }}
          </p>
          <input
            type="file"
            accept="image/*"
            @change="(e) => idCardFile = (e.target as HTMLInputElement).files?.[0] || null"
            class="hidden"
            id="id-upload"
          />
          <label
            for="id-upload"
            class="mt-4 inline-block px-4 py-2 bg-gray-700 rounded-md cursor-pointer hover:bg-gray-600 transition-colors"
          >
            Browse Files
          </label>
        </div>

        <div v-if="idCardFile" class="mb-6">
          <button
            @click="verifyIDCard"
            :disabled="idVerificationStatus === 'loading'"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors disabled:bg-gray-600"
          >
            {{ idVerificationStatus === 'loading' ? 'Verifying...' : 'Verify ID' }}
          </button>

          <div
            v-if="idVerificationStatus === 'approved'"
            class="mt-4 flex items-center gap-2 text-green-400"
          >
            <CheckCircle class="h-5 w-5" />
            <span>ID Approved! You may now vote.</span>
          </div>
          <div
            v-if="idVerificationStatus === 'rejected'"
            class="mt-4 flex items-center gap-2 text-red-400"
          >
            <X class="h-5 w-5" />
            <span>ID Rejected. Please try again with a valid ID.</span>
          </div>
        </div>

        <!-- Vote Submission -->
        <div
          v-if="
            idVerificationStatus === 'approved' &&
            selectedCandidate &&
            isElectionActive(selectedElection)
          "
          class="pt-6 border-t border-gray-700"
        >
          <button
            @click="submitVote"
            :disabled="voteSubmissionStatus === 'loading'"
            class="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-500 transition-colors disabled:bg-gray-600 w-full"
          >
            {{
              voteSubmissionStatus === 'loading' ? 'Submitting...' : `Vote for ${selectedCandidate}`
            }}
          </button>

          <div
            v-if="voteSubmissionStatus === 'success'"
            class="mt-4 flex items-center gap-2 text-green-400"
          >
            <CheckCircle class="h-5 w-5" />
            <span>Vote submitted successfully!</span>
          </div>
          <div
            v-if="voteSubmissionStatus === 'error'"
            class="mt-4 flex items-center gap-2 text-red-400"
          >
            <X class="h-5 w-5" />
            <span>Failed to submit vote. Please try again.</span>
          </div>
        </div>

        <div
          v-else-if="isElectionActive(selectedElection)"
          class="pt-6 border-t border-gray-700 text-center text-gray-400"
        >
          <p v-if="!selectedCandidate">Please select a candidate to vote for</p>
          <p v-else-if="idVerificationStatus !== 'approved'">
            Please verify your ID to complete voting
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
