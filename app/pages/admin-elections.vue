<script setup lang="ts">
import { useAppKitAccount } from '@reown/appkit/vue'
import {
  ArrowLeft,
  Calendar,
  Clock,
  Image as ImageIcon,
  Key,
  List,
  Lock,
  Play,
  Plus,
  StopCircle,
  Trash2,
  Upload,
  User,
  Users,
  X,
  BarChart2,
  Trophy,
  Percent,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
} from 'lucide-vue-next'
import { onMounted, ref } from 'vue'

const appKitAccount = useAppKitAccount({ namespace: 'solana' })

interface Election {
  id: string
  title: string
  creatorAddress: string
  startTime: number
  endTime: number
  isPrivate: boolean
  isActive: boolean
  publicKey: string
  privateKey: string
  idCardTemplate: string
  whitelist: string[]
  voters: string[]
  candidates: { name: string; picture: string; manifesto: string }[]
  results?: {
    totalVotes: number
    candidates: Array<{
      name: string
      votes: number
      percentage: number
    }>
    winners: string[]
    closedAt: string
    decryptedVotes: Array<{
      candidate: string
      voter: string
      timestamp: string
    }>
  }
}

interface NewElection {
  title: string
  candidates: { name: string; picture: string; manifesto: string }[]
  isPrivate: boolean
  startTime: string
  endTime: string
  idCardTemplate: string
}

// State
const elections = ref<Election[]>([])
const newElection = ref<NewElection>({
  title: '',
  candidates: [{ name: '', picture: '', manifesto: '' }],
  isPrivate: false,
  startTime: '',
  endTime: '',
  idCardTemplate: '',
})
const selectedElection = ref<Election | null>(null)
const showCreateModal = ref(false)
const showWhitelistModal = ref(false)
const newWhitelistAddress = ref('')
const templateImagePreview = ref<string | null>(null)
const isLoading = ref({
  elections: false,
  create: false,
  toggle: false,
  whitelist: false,
  upload: false,
  results: false,
})
const showResults = ref(false)

// Computed
const timeRemaining = (endTime: number) => {
  const end = new Date(endTime)
  const now = new Date()
  const diff = end.getTime() - now.getTime()
  if (diff <= 0) return 'Finished'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  return `${days}d ${hours}h remaining`
}

// Methods
const fetchElections = async () => {
  isLoading.value.elections = true
  try {
    elections.value = await $fetch(`/api/elections?creatorAddress=${appKitAccount.value.address}`)
  } catch (error) {
    console.error('Failed to fetch elections:', error)
  } finally {
    isLoading.value.elections = false
  }
}

const fetchElectionVoters = async () => {
  try {
    const { voters } = await $fetch(`/api/elections/${selectedElection.value?.id}/voters`)
    if (selectedElection.value) {
      selectedElection.value.voters = voters
    }
  } catch (error) {
    console.error('Failed to fetch election voters:', error)
  }
}

const fetchElectionResults = async () => {
  isLoading.value.results = true
  if (!selectedElection.value) {
    return
  }
  try {
    const results = await $fetch(`/api/elections/${selectedElection.value?.id}/results`)
    if (selectedElection.value) {
      selectedElection.value.results = results
    }
  } catch (error) {
    console.error('Failed to fetch election results:', error)
  } finally {
    isLoading.value.results = false
  }
}

const fetchElectionDetails = async (election: Election) => {
  selectedElection.value = election
  await fetchElectionVoters()
  await fetchElectionResults()
}

const toggleElectionStatus = async (election: Election) => {
  isLoading.value.toggle = true
  try {
    const updated = await $fetch(`/api/elections/${election.id}/toggle`, {
      method: 'POST',
      body: { userAddress: appKitAccount.value.address },
    })
    const index = elections.value.findIndex((e) => e.id === election.id)
    if (index !== -1) {
      elections.value[index] = {
        ...elections.value[index],
        ...updated,
        startTime: new Date(updated.startTime).getTime(),
        endTime: new Date(updated.endTime).getTime(),
      }
      if (selectedElection.value?.id === election.id) {
        selectedElection.value = {
          ...selectedElection.value,
          ...updated,
          startTime: new Date(updated.startTime).getTime(),
          endTime: new Date(updated.endTime).getTime(),
        }
        if (!updated.isActive) {
          await fetchElectionResults(election.id)
          showResults.value = true
        }
      }
    }
  } catch (error) {
    console.error('Failed to toggle election status:', error)
  } finally {
    isLoading.value.toggle = false
  }
}

const addElection = async () => {
  if (
    !newElection.value.title ||
    !newElection.value.candidates.length ||
    !newElection.value.idCardTemplate
  )
    return
  isLoading.value.create = true
  const body = {
    ...newElection.value,
    creatorAddress: appKitAccount?.value?.address,
    startTime: new Date(newElection.value.startTime).toISOString(),
    endTime: new Date(newElection.value.endTime).toISOString(),
  }
  try {
    const election = await $fetch('/api/elections', {
      method: 'POST',
      body,
    })
    elections.value.push(election)
    resetNewElection()
    showCreateModal.value = false
  } catch (error) {
    console.error('Failed to create election:', error)
  } finally {
    isLoading.value.create = false
  }
}

const addToWhitelist = async () => {
  if (!newWhitelistAddress.value || !selectedElection.value) return
  isLoading.value.whitelist = true
  try {
    const updated = await $fetch(`/api/elections/${selectedElection.value.id}/whitelist`, {
      method: 'POST',
      body: { address: newWhitelistAddress.value },
    })
    selectedElection.value.whitelist = updated.whitelist
    newWhitelistAddress.value = ''
  } catch (error) {
    console.error('Failed to add to whitelist:', error)
  } finally {
    isLoading.value.whitelist = false
  }
}

const removeFromWhitelist = async (index: number) => {
  if (!selectedElection.value) return
  const address = selectedElection.value.whitelist[index]
  isLoading.value.whitelist = true
  try {
    const updated = await $fetch(
      `/api/elections/${selectedElection.value.id}/whitelist/${address}`,
      {
        method: 'DELETE',
      }
    )
    selectedElection.value.whitelist = updated.whitelist
  } catch (error) {
    console.error('Failed to remove from whitelist:', error)
  } finally {
    isLoading.value.whitelist = false
  }
}

const handleTemplateUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    const file = input.files[0]
    if (file.type.startsWith('image/')) {
      isLoading.value.upload = true
      try {
        const formData = new FormData()
        formData.append('file', file)
        const blobObject = await $fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })
        templateImagePreview.value = 'api/media/' + blobObject.pathname
        newElection.value.idCardTemplate = 'api/media/' + blobObject.pathname
      } catch (error) {
        console.error('Failed to upload template:', error)
      } finally {
        isLoading.value.upload = false
      }
    }
  }
}

const resetNewElection = () => {
  newElection.value = {
    title: '',
    candidates: [{ name: '', picture: '', manifesto: '' }],
    isPrivate: false,
    startTime: '',
    endTime: '',
    idCardTemplate: '',
  }
  templateImagePreview.value = null
}

const addCandidate = () => {
  newElection.value.candidates.push({ name: '', picture: '', manifesto: '' })
}

const removeCandidate = (index: number) => {
  newElection.value.candidates.splice(index, 1)
}

const removeTemplate = () => {
  templateImagePreview.value = null
  newElection.value.idCardTemplate = ''
}

const getWinnerNames = (winners: string[]) => {
  if (!winners || winners.length === 0) return ''
  if (winners.length === 1) return winners[0]
  if (winners.length === 2) return `${winners[0]} and ${winners[1]}`
  return `${winners.slice(0, -1).join(', ')}, and ${winners[winners.length - 1]}`
}

const getBarColor = (candidate: { candidate: string }) => {
  const colors = [
    '#3b82f6', // blue-500
    '#10b981', // emerald-500
    '#8b5cf6', // violet-500
    '#f59e0b', // amber-500
    '#ef4444', // red-500
    '#06b6d4', // cyan-500
  ]
  let hash = 0
  for (let i = 0; i < candidate.candidate.length; i++) {
    hash = candidate.candidate.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

watch(
  () => appKitAccount.value?.address,
  () => {
    if (appKitAccount.value?.address) {
      fetchElections()
    }
  },
  { immediately: true }
)
</script>

<template>
  <div class="min-h-screen bg-gray-900 text-gray-100 p-8">
    <div v-if="appKitAccount.address">
      <!-- Main Admin View -->
      <div v-if="!selectedElection" class="max-w-6xl mx-auto">
        <div class="flex justify-between items-center mb-8">
          <h1 class="text-3xl font-bold text-white">Manage Elections</h1>
          <UButton
            @click="showCreateModal = true"
            class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors"
          >
            <Plus class="h-5 w-5" />
            <span>Create Election</span>
          </UButton>
        </div>
        <div v-if="!isLoading.elections && appKitAccount.address" class="flex justify-center py-12">
          <p class="text-gray-400">You haven't created any elections yet. Create a new election!</p>
        </div>
        <div v-if="isLoading.elections || !appKitAccount.address" class="flex justify-center py-12">
          <p class="text-gray-400">Loading elections...</p>
        </div>
        <div v-else class="space-y-6">
          <div
            v-for="election in elections"
            :key="election.id"
            @click="fetchElectionDetails(election)"
            class="bg-gray-800 p-6 rounded-lg shadow-lg cursor-pointer hover:bg-gray-700 transition-colors border border-gray-700"
          >
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <h2 class="text-xl font-semibold text-white mb-2">{{ election.title }}</h2>
                <div class="flex items-center gap-4 text-sm text-gray-400">
                  <div class="flex items-center gap-1">
                    <Calendar class="h-4 w-4" />
                    <span>{{ new Date(election.startTime).toLocaleDateString() }}</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <Clock class="h-4 w-4" />
                    <span>{{ timeRemaining(election.endTime) }}</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <User class="h-4 w-4" />
                    <span
                      >{{ election.creatorAddress.slice(0, 6) }}...{{
                        election.creatorAddress.slice(-4)
                      }}</span
                    >
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <Lock v-if="election.isPrivate" class="h-5 w-5 text-red-400" />
                <span v-if="election.isPrivate" class="text-red-400 text-sm">Private</span>
                <span v-else class="text-green-400 text-sm">Public</span>
                <span
                  class="text-sm px-2 py-1 rounded-full"
                  :class="
                    election.isActive ? 'bg-green-900 text-green-400' : 'bg-gray-700 text-gray-400'
                  "
                >
                  {{ election.isActive ? 'Active' : 'Finished' }}
                </span>
              </div>
            </div>
            <div class="mt-4 flex items-center gap-2 text-sm text-gray-400">
              <Users class="h-4 w-4" />
              <span>{{ election.voters.length }} voters</span>
              <div v-if="election.results" class="ml-4 flex items-center gap-1">
                <BarChart2 class="h-4 w-4 text-purple-400" />
                <span class="text-purple-400">Results available</span>
              </div>
              <Key class="h-4 w-4 ml-4" />
              <span>Keys generated</span>
              <ImageIcon class="h-4 w-4 ml-4" />
              <span>ID Template {{ election.idCardTemplate ? 'set' : 'not set' }}</span>
            </div>
          </div>
        </div>
      </div>
      <!-- Election Details View -->
      <div v-else class="max-w-6xl mx-auto">
        <button
          @click="
            () => {
              selectedElection = null
              showResults = false
            }
          "
          class="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft class="h-5 w-5" />
          <span>Back to Elections</span>
        </button>
        <div class="bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700 mb-8">
          <div class="flex justify-between items-start mb-6">
            <div>
              <h1 class="text-3xl font-bold text-white mb-2">{{ selectedElection.title }}</h1>
              <div class="flex items-center gap-4 text-gray-400">
                <div class="flex items-center gap-1">
                  <Calendar class="h-4 w-4" />
                  <span>{{ new Date(selectedElection.startTime).toLocaleDateString() }}</span>
                </div>
                <div class="flex items-center gap-1">
                  <Clock class="h-4 w-4" />
                  <span>{{ timeRemaining(selectedElection.endTime) }}</span>
                </div>
                <div class="flex items-center gap-1">
                  <User class="h-4 w-4" />
                  <span
                    >{{ selectedElection.creatorAddress.slice(0, 6) }}...{{
                      selectedElection.creatorAddress.slice(-4)
                    }}</span
                  >
                </div>
              </div>
            </div>
            <div class="flex gap-2">
              <button
                @click="toggleElectionStatus(selectedElection)"
                class="flex items-center gap-1 px-3 py-1 text-sm rounded-md transition-colors"
                :class="
                  selectedElection.isActive
                    ? 'bg-red-900 text-red-400 hover:bg-red-800'
                    : 'bg-green-900 text-green-400 hover:bg-green-800'
                "
                :disabled="isLoading.toggle"
              >
                <StopCircle v-if="selectedElection.isActive" class="h-4 w-4" />
                <Play v-else class="h-4 w-4" />
                <span>{{ selectedElection.isActive ? 'Close' : 'Start' }} Election</span>
              </button>
              <button
                v-if="selectedElection.isPrivate"
                @click="showWhitelistModal = true"
                class="flex items-center gap-1 px-3 py-1 bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm rounded-md transition-colors"
                :disabled="isLoading.whitelist"
              >
                <List class="h-4 w-4" />
                <span>Manage Whitelist</span>
              </button>
              <button
                v-if="!selectedElection.isActive"
                @click="showResults = !showResults"
                class="flex items-center gap-1 px-3 py-1 bg-purple-700 text-purple-300 hover:bg-purple-600 text-sm rounded-md transition-colors"
              >
                <BarChart2 class="h-4 w-4" />
                <span>{{ showResults ? 'Hide Results' : 'View Results' }}</span>
              </button>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div class="bg-gray-700 p-4 rounded-lg">
              <h3 class="font-semibold text-white mb-2">Public Key</h3>
              <p class="text-sm text-gray-300 font-mono break-all">
                {{ selectedElection.publicKey }}
              </p>
            </div>
            <div class="bg-gray-700 p-4 rounded-lg">
              <h3 class="font-semibold text-white mb-2">Private Key</h3>
              <p class="text-sm text-gray-300 font-mono break-all">
                {{ selectedElection.privateKey }}
              </p>
            </div>
          </div>
          <!-- ID Card Template Preview -->
          <div v-if="selectedElection.idCardTemplate" class="bg-gray-700 p-4 rounded-lg mb-6">
            <h3 class="font-semibold text-white mb-3">ID Card Template</h3>
            <div class="flex flex-col items-center">
              <img
                :src="`/${selectedElection.idCardTemplate}`"
                alt="ID Card Template"
                class="max-h-64 max-w-full object-contain mb-3 border border-gray-600 rounded"
              />
              <p class="text-sm text-gray-400">This template will be used for ID verification</p>
            </div>
          </div>
          <div class="bg-gray-700 p-4 rounded-lg mb-6">
            <h3 class="font-semibold text-white mb-4">Candidates</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div
                v-for="candidate in selectedElection.candidates"
                :key="candidate.name"
                class="bg-gray-800 p-4 rounded-lg border border-gray-600"
              >
                <img
                  :src="candidate.picture"
                  alt="Candidate"
                  class="h-16 w-16 rounded-full object-cover mx-auto mb-3"
                />
                <h4 class="font-medium text-white text-center">{{ candidate.name }}</h4>
                <p class="text-sm text-gray-300 text-center line-clamp-3">
                  {{ candidate.manifesto }}
                </p>
              </div>
            </div>
          </div>
          <!-- Voters Section -->
          <div class="bg-gray-700 p-4 rounded-lg">
            <h3 class="font-semibold text-white mb-4">Voters</h3>
            <div class="flex justify-between items-center mb-3">
              <span class="text-sm text-gray-400">{{ selectedElection.voters.length }} voters</span>
            </div>
            <div
              v-if="selectedElection.voters.length"
              class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3"
            >
              <div
                v-for="voter in selectedElection.voters"
                :key="voter"
                class="bg-gray-800 px-3 py-2 rounded-md text-sm text-gray-300"
              >
                {{ voter.slice(0, 6) }}...{{ voter.slice(-4) }}
              </div>
            </div>
            <p v-else class="text-gray-400 text-center py-4">No voters yet</p>
          </div>
        </div>
        <!-- Election Results Section -->
        <div
          v-if="showResults"
          class="bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700 mb-8"
        >
          <h2 class="text-2xl font-bold mb-6 text-white flex items-center gap-2">
            <BarChart2 class="h-6 w-6" />
            Election Results
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div class="bg-gray-700 p-4 rounded-lg">
              <h3 class="font-semibold text-white mb-2">Total Votes</h3>
              <p class="text-2xl font-bold text-white">{{ selectedElection.results.totalVotes }}</p>
            </div>
            <div class="bg-gray-700 p-4 rounded-lg">
              <h3 class="font-semibold text-white mb-2">Closed At</h3>
              <p class="text-white">
                {{ new Date(selectedElection.results.closedAt).toLocaleString() }}
              </p>
            </div>
          </div>
          <div class="bg-gray-700 p-4 rounded-lg mb-6">
            <h3 class="font-semibold text-white mb-4">Results Breakdown</h3>
            <div class="space-y-4">
              <div
                v-for="candidate in selectedElection.results.candidates"
                :key="candidate.name"
                class="bg-gray-800 p-4 rounded-lg"
              >
                <div class="flex justify-between items-center">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center"
                    >
                      <span class="text-white font-semibold">{{
                        candidate.candidate.charAt(0)
                      }}</span>
                    </div>
                    <div>
                      <h4 class="font-semibold text-white">{{ candidate.candidate }}</h4>
                      <p class="text-gray-400 text-sm">{{ candidate.votes }} votes</p>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="text-white font-semibold">{{ candidate.percentage.toFixed(1) }}%</p>
                    <div class="w-32 h-2 bg-gray-600 rounded-full mt-1">
                      <div
                        class="h-full rounded-full"
                        :style="{
                          width: `${candidate.percentage}%`,
                          backgroundColor: getBarColor(candidate),
                        }"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-gray-700 p-4 rounded-lg mb-6">
            <h3 class="font-semibold text-white mb-4 flex items-center gap-2">
              <Trophy class="h-5 w-5" />
              Winners
            </h3>
            <div class="bg-gray-800 p-4 rounded-md">
              <p class="text-white">
                {{ getWinnerNames(selectedElection.results.winners) }}
                {{ selectedElection.results.winners.length > 1 ? 'are' : 'is' }}
                the {{ selectedElection.results.winners.length > 1 ? 'winners' : 'winner' }} with
                {{
                  selectedElection.results.candidates.find((c) =>
                    selectedElection.results?.winners.includes(c.name)
                  )?.votes
                }}
                votes
              </p>
            </div>
          </div>
          <!-- Decrypted Votes Audit Section -->
          <div class="bg-gray-700 p-4 rounded-lg">
            <h3 class="font-semibold text-white mb-4 flex items-center gap-2">
              <Eye class="h-5 w-5" />
              Decrypted Votes Audit
            </h3>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-700">
                <thead class="bg-gray-800">
                  <tr>
                    <th
                      scope="col"
                      class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                    >
                      Voter
                    </th>
                    <th
                      scope="col"
                      class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                    >
                      Candidate
                    </th>
                    <th
                      scope="col"
                      class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                    >
                      Timestamp
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-gray-800 divide-y divide-gray-700">
                  <tr v-for="(vote, index) in selectedElection.results.decryptedVotes" :key="index">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {{ vote.voter.slice(0, 6) }}...{{ vote.voter.slice(-4) }}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {{ vote.candidate }}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {{ new Date(vote.timestamp).toLocaleString() }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <!-- Whitelist Management Modal -->
        <div
          v-if="showWhitelistModal && selectedElection?.isPrivate"
          class="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50"
          @click.self="showWhitelistModal = false"
        >
          <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl">
            <div class="p-6">
              <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-white">Manage Whitelist</h2>
                <button @click="showWhitelistModal = false" class="text-gray-400 hover:text-white">
                  <X class="h-6 w-6" />
                </button>
              </div>
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-1"
                    >Add Wallet Address</label
                  >
                  <div class="flex gap-2">
                    <input
                      v-model="newWhitelistAddress"
                      type="text"
                      class="flex-1 bg-gray-700 text-white rounded-md px-3 py-2 border border-gray-600 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                      placeholder="Jns...vDq"
                    />
                    <button
                      @click="addToWhitelist"
                      :disabled="!newWhitelistAddress || isLoading.whitelist"
                      class="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors disabled:bg-gray-600"
                    >
                      <Plus class="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <h3 class="text-lg font-medium text-white mb-3">Whitelisted Addresses</h3>
                  <div
                    v-if="selectedElection.whitelist.length"
                    class="space-y-2 max-h-64 overflow-y-auto"
                  >
                    <div
                      v-for="(address, index) in selectedElection.whitelist"
                      :key="index"
                      class="flex justify-between items-center bg-gray-700 p-3 rounded-md"
                    >
                      <span class="text-sm text-gray-300"
                        >{{ address.slice(0, 6) }}...{{ address.slice(-4) }}</span
                      >
                      <button
                        @click="removeFromWhitelist(index)"
                        class="text-gray-400 hover:text-red-400"
                        :disabled="isLoading.whitelist"
                      >
                        <Trash2 class="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p v-else class="text-gray-400 text-center py-4">No addresses whitelisted yet</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- Create Election Modal -->
      <div
        v-if="showCreateModal"
        class="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50"
        @click.self="showCreateModal = false"
      >
        <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          <div class="p-6">
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-bold text-white">Create New Election</h2>
              <button @click="showCreateModal = false" class="text-gray-400 hover:text-white">
                <X class="h-6 w-6" />
              </button>
            </div>
            <div class="space-y-6">
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">Election Title</label>
                <input
                  v-model="newElection.title"
                  type="text"
                  class="w-full bg-gray-700 text-white rounded-md px-3 py-2 border border-gray-600 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  placeholder="e.g., UNIABUJA SUG President 2025"
                />
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-1">Start Time</label>
                  <input
                    v-model="newElection.startTime"
                    type="datetime-local"
                    class="w-full bg-gray-700 text-white rounded-md px-3 py-2 border border-gray-600 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-1">End Time</label>
                  <input
                    v-model="newElection.endTime"
                    type="datetime-local"
                    class="w-full bg-gray-700 text-white rounded-md px-3 py-2 border border-gray-600 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  />
                </div>
              </div>
              <div class="flex items-center gap-3">
                <input
                  v-model="newElection.isPrivate"
                  type="checkbox"
                  id="private-election"
                  class="rounded text-blue-500 focus:ring-blue-400"
                />
                <label for="private-election" class="text-sm text-gray-300"
                  >Private Election (Whitelist Required)</label
                >
              </div>
              <!-- ID Card Template Upload -->
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">ID Card Template</label>
                <p class="text-xs text-gray-400 mb-2">
                  Upload an image of the ID card template for verification
                </p>
                <div
                  @click="$refs.templateUpload.click()"
                  class="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
                >
                  <input
                    type="file"
                    ref="templateUpload"
                    @change="handleTemplateUpload"
                    accept="image/*"
                    class="hidden"
                  />
                  <Upload class="mx-auto h-10 w-10 text-gray-400 mb-2" />
                  <p class="text-gray-300">
                    {{
                      isLoading.upload
                        ? 'Uploading...'
                        : templateImagePreview
                        ? 'Template uploaded. Click to change.'
                        : 'Click to upload or drag and drop'
                    }}
                  </p>
                  <p class="text-xs text-gray-400 mt-1">PNG, JPG (Max. 5MB)</p>
                </div>
                <!-- Template Preview -->
                <div v-if="templateImagePreview" class="mt-4">
                  <div class="relative">
                    <img
                      :src="templateImagePreview"
                      alt="ID Template Preview"
                      class="max-h-48 w-auto mx-auto rounded border border-gray-600"
                    />
                    <button
                      @click="removeTemplate"
                      class="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 text-white hover:bg-red-500 transition-colors"
                    >
                      <X class="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <div class="flex justify-between items-center mb-4">
                  <h3 class="text-lg font-medium text-white">Candidates</h3>
                  <button
                    @click="addCandidate"
                    class="flex items-center gap-1 px-3 py-1 bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm rounded-md transition-colors"
                  >
                    <Plus class="h-4 w-4" />
                    <span>Add Candidate</span>
                  </button>
                </div>
                <div class="space-y-4">
                  <div
                    v-for="(candidate, index) in newElection.candidates"
                    :key="index"
                    class="bg-gray-700 p-4 rounded-lg border border-gray-600 relative"
                  >
                    <button
                      @click="removeCandidate(index)"
                      class="absolute top-2 right-2 text-gray-400 hover:text-red-400"
                    >
                      <Trash2 class="h-4 w-4" />
                    </button>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Name</label>
                        <input
                          v-model="candidate.name"
                          type="text"
                          class="w-full bg-gray-600 text-white rounded-md px-3 py-2 border border-gray-500 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                          placeholder="Candidate name"
                        />
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1"
                          >Picture URL</label
                        >
                        <input
                          v-model="candidate.picture"
                          type="text"
                          class="w-full bg-gray-600 text-white rounded-md px-3 py-2 border border-gray-500 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                          placeholder="https://example.com/picture.jpg"
                        />
                      </div>
                    </div>
                    <div class="mt-4">
                      <label class="block text-sm font-medium text-gray-300 mb-1">Manifesto</label>
                      <textarea
                        v-model="candidate.manifesto"
                        rows="4"
                        class="w-full bg-gray-600 text-white rounded-md px-3 py-2 border border-gray-500 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                        placeholder="Candidate manifesto..."
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex justify-end gap-3 mt-6">
                <button
                  @click="showCreateModal = false"
                  class="px-4 py-2 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  @click="addElection"
                  :disabled="
                    !newElection.title ||
                    !newElection.candidates.length ||
                    !newElection.idCardTemplate
                  "
                  class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  <Plus class="h-4 w-4" />
                  <span>{{ isLoading.create ? 'Creating...' : 'Create Election' }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <h2 v-else>Kindly connect your wallet!👷🏾</h2>
  </div>
</template>
