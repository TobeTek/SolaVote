<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Calendar,
  User,
  Clock,
  Lock,
  Key,
  CheckCircle,
  XCircle,
  Fingerprint,
  AlertTriangle,
} from 'lucide-vue-next'
import { MerkleTree } from 'merkletreejs'
import { sha256 } from '@noble/hashes/sha2.js'
import { getAddressBytes } from '~~/common'
import type { Address } from '@solana/kit'

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
  merkleRoot: string | null
  candidates: Array<{
    name: string
    picture: string
    manifesto: string
  }>
}

interface MerkleProofResponse {
  merkleRoot: string
  proof: string[]
  address: string
}

// State
const route = useRoute()
const router = useRouter()
const election = ref<Election | null>(null)
const userAddress = ref('') // In a real app, this would come from wallet connection
const isLoading = ref({
  election: true,
  proof: false,
  verification: false,
})
const error = ref<string | null>(null)
const merkleProof = ref<string[] | null>(null)
const isVerified = ref<boolean | null>(null)
const verificationError = ref<string | null>(null)
const showWalletConnect = ref(false)

// Computed
const timeRemaining = computed(() => {
  if (!election.value?.endTime) return 'Unknown'
  const end = new Date(election.value.endTime)
  const now = new Date()
  const diff = end.getTime() - now.getTime()
  if (diff <= 0) return 'Closed'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  return `${days}d ${hours}h remaining`
})

const isElectionActive = computed(() => {
  if (!election.value) return false
  const now = new Date()
  const start = new Date(election.value.startTime)
  const end = new Date(election.value.endTime)
  return election.value.isActive && now >= start && now <= end
})

// Methods
const fetchElection = async () => {
  try {
    isLoading.value.election = true
    election.value = await $fetch(`/api/elections/${route.params.id}`)

    // If private election and we have a user address, fetch Merkle proof
    if (election.value.isPrivate && userAddress.value) {
      await fetchMerkleProof()
    }
  } catch (err) {
    console.error('Failed to load election:', err)
    error.value = 'Failed to load election details'
  } finally {
    isLoading.value.election = false
  }
}

const fetchMerkleProof = async () => {
  if (!election.value?.isPrivate || !userAddress.value) return

  try {
    isLoading.value.proof = true
    const { proof } = await $fetch(`/api/elections/${route.params.id}/proof`, {
      method: 'GET',
      body: { address: userAddress.value },
    })
    merkleProof.value = proof
  } catch (err) {
    console.error('Failed to fetch Merkle proof:', err)
    error.value = 'Failed to verify your whitelist status'
  } finally {
    isLoading.value.proof = false
  }
}

const verifyMerkleProof = () => {
  if (!election.value?.isPrivate || !merkleProof.value || !userAddress.value) return

  try {
    isLoading.value.verification = true
    verificationError.value = null

    // Hash the address (same as how leaves were created)
    const leaf = sha256(getAddressBytes(userAddress.value as Address)).toString()

    // Verify the proof
    const root = MerkleTree.verify(merkleProof.value, leaf, election.value?.merkleRoot)
    isVerified.value = root === election.value?.merkleRoot
  } catch (err) {
    console.error('Verification failed:', err)
    verificationError.value = 'Verification failed'
    isVerified.value = false
  } finally {
    isLoading.value.verification = false
  }
}

const connectWallet = () => {
  // In a real app, this would connect to a wallet provider
  // For demo purposes, we'll just set a mock address
  userAddress.value =
    '0x' +
    Array(40)
      .fill(0)
      .map(() => Math.floor(Math.random() * 16).toString(16))
      .join('')
  showWalletConnect.value = false

  // If we just connected and it's a private election, fetch the proof
  if (election.value?.isPrivate) {
    fetchMerkleProof()
  }
}

const copyPublicKey = () => {
  if (!election.value?.publicKey) return
  navigator.clipboard.writeText(election.value.publicKey)
  // You might want to show a "copied" notification here
}

// Lifecycle
onMounted(fetchElection)
</script>

<template>
  <div class="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-8">
    <!-- Loading state -->
    <div v-if="isLoading.election" class="max-w-4xl mx-auto">
      <div class="bg-gray-800 rounded-lg p-8 text-center">
        <p class="text-gray-400">Loading election details...</p>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="max-w-4xl mx-auto">
      <div class="bg-red-900/30 border border-red-900 rounded-lg p-6 text-center">
        <AlertTriangle class="mx-auto h-8 w-8 text-red-400 mb-2" />
        <p class="text-red-400">{{ error }}</p>
        <button
          @click="fetchElection"
          class="mt-4 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>

    <!-- Main election view -->
    <div v-else-if="election" class="max-w-4xl mx-auto space-y-6">
      <!-- Election header -->
      <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-4">
          <div>
            <h1 class="text-2xl md:text-3xl font-bold text-white mb-2">{{ election.title }}</h1>
            <div class="flex flex-wrap gap-4 text-sm text-gray-400">
              <div class="flex items-center gap-1">
                <Calendar class="h-4 w-4" />
                <span>Start: {{ new Date(election.startTime).toLocaleString() }}</span>
              </div>
              <div class="flex items-center gap-1">
                <Clock class="h-4 w-4" />
                <span>Time remaining: {{ timeRemaining }}</span>
              </div>
            </div>
          </div>

          <div class="mt-4 md:mt-0 flex flex-wrap gap-2">
            <div class="flex items-center gap-1">
              <Lock
                class="h-4 w-4"
                :class="election.isPrivate ? 'text-red-400' : 'text-green-400'"
              />
              <span class="text-sm">{{ election.isPrivate ? 'Private' : 'Public' }} Election</span>
            </div>
            <div class="flex items-center gap-1">
              <span
                class="px-2 py-1 rounded-full text-xs"
                :class="
                  isElectionActive ? 'bg-green-900 text-green-400' : 'bg-gray-700 text-gray-400'
                "
              >
                {{ isElectionActive ? 'Active' : election.isActive ? 'Upcoming' : 'Closed' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Election status banner -->
        <div
          v-if="!isElectionActive"
          class="bg-yellow-900/30 border border-yellow-900 rounded-md p-3 flex items-center gap-2"
        >
          <AlertTriangle class="h-5 w-5 text-yellow-400" />
          <span class="text-yellow-400 text-sm">
            {{
              election.isActive ? 'This election has not started yet' : 'This election is closed'
            }}
          </span>
        </div>
      </div>

      <!-- Public Key Section -->
      <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold text-white">Vote Encryption</h2>
          <button
            @click="copyPublicKey"
            class="flex items-center gap-1 px-3 py-1 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded-md text-sm transition-colors"
          >
            <Key class="h-4 w-4" />
            <span>Copy Public Key</span>
          </button>
        </div>

        <div class="bg-gray-900/50 rounded-md p-4 mb-4">
          <p class="text-sm text-gray-300 font-mono break-all">{{ election.publicKey }}</p>
        </div>

        <p class="text-sm text-gray-400">
          Use this public key to encrypt your vote before submission. Only the election
          administrator can decrypt votes.
        </p>
      </div>

      <!-- Private Election Verification -->
      <div v-if="election.isPrivate" class="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold text-white">Whitelist Verification</h2>
          <div class="flex items-center gap-2">
            <span v-if="userAddress" class="text-sm text-gray-400">
              {{ userAddress.slice(0, 6) }}...{{ userAddress.slice(-4) }}
            </span>
            <button
              @click="showWalletConnect = true"
              v-if="!userAddress"
              class="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white hover:bg-blue-500 rounded-md text-sm transition-colors"
            >
              <Fingerprint class="h-4 w-4" />
              <span>Connect Wallet</span>
            </button>
            <button
              v-else
              @click="fetchMerkleProof"
              :disabled="isLoading.proof"
              class="flex items-center gap-1 px-3 py-1 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded-md text-sm transition-colors disabled:opacity-50"
            >
              <span v-if="isLoading.proof">Refreshing...</span>
              <span v-else>Refresh Proof</span>
            </button>
          </div>
        </div>

        <!-- Verification status -->
        <div v-if="userAddress" class="space-y-4">
          <div v-if="isLoading.proof" class="text-center py-4">
            <p class="text-gray-400">Loading verification proof...</p>
          </div>

          <div v-else-if="merkleProof" class="space-y-3">
            <div class="bg-gray-900/50 rounded-md p-3">
              <p class="text-sm text-gray-400 mb-2">Merkle Proof Path:</p>
              <div class="max-h-40 overflow-y-auto">
                <div
                  v-for="(proof, index) in merkleProof"
                  :key="index"
                  class="text-xs text-gray-300 font-mono py-1"
                >
                  {{ index + 1 }}. {{ proof }}
                </div>
              </div>
            </div>

            <button
              @click="verifyMerkleProof"
              :disabled="isLoading.verification"
              class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors disabled:bg-gray-600"
            >
              <span v-if="isLoading.verification">Verifying...</span>
              <span v-else>Verify Whitelist Membership</span>
            </button>

            <div
              v-if="isVerified !== null"
              class="flex items-center justify-center gap-2 p-3 rounded-md"
              :class="
                isVerified
                  ? 'bg-green-900/30 border border-green-900'
                  : 'bg-red-900/30 border border-red-900'
              "
            >
              <CheckCircle v-if="isVerified" class="h-5 w-5 text-green-400" />
              <XCircle v-else class="h-5 w-5 text-red-400" />
              <span :class="isVerified ? 'text-green-400' : 'text-red-400'">
                {{ isVerified ? '✓ Verified: You are whitelisted!' : '✗ Verification failed' }}
              </span>
            </div>

            <p v-if="verificationError" class="text-red-400 text-sm text-center">
              {{ verificationError }}
            </p>
          </div>

          <div v-else class="text-center py-4">
            <p class="text-gray-400">No verification proof available</p>
          </div>

          <!-- Merkle Root -->
          <div class="bg-gray-900/50 rounded-md p-3 mt-4">
            <p class="text-sm text-gray-400 mb-1">Merkle Root:</p>
            <p class="text-xs text-gray-300 font-mono break-all">{{ election.merkleRoot }}</p>
          </div>
        </div>

        <div v-else class="text-center py-8">
          <button
            @click="showWalletConnect = true"
            class="flex items-center justify-center gap-2 mx-auto px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors"
          >
            <Fingerprint class="h-5 w-5" />
            <span>Connect Wallet to Verify</span>
          </button>
          <p class="text-gray-400 text-sm mt-2">
            This is a private election. Connect your wallet to verify you're whitelisted.
          </p>
        </div>
      </div>

      <!-- ID Card Template -->
      <div v-if="election.idCardTemplate" class="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 class="text-xl font-semibold text-white mb-4">ID Verification Template</h2>
        <div class="flex flex-col items-center">
          <img
            :src="election.idCardTemplate"
            alt="ID Card Template"
            class="max-h-64 w-auto object-contain mb-3 border border-gray-600 rounded"
          />
          <p class="text-sm text-gray-400 text-center">
            Your ID card should match this template for verification. You'll need to upload your ID
            when voting.
          </p>
        </div>
      </div>

      <!-- Candidates Section -->
      <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 class="text-xl font-semibold text-white mb-6">Candidates</h2>

        <div v-if="election.candidates.length === 0" class="text-center py-4">
          <p class="text-gray-400">No candidates available</p>
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="candidate in election.candidates"
            :key="candidate.name"
            class="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:border-gray-400 transition-colors"
          >
            <div class="flex flex-col items-center">
              <img
                :src="candidate.picture"
                :alt="`${candidate.name} photo`"
                class="h-24 w-24 rounded-full object-cover mb-3 border-2 border-gray-600"
              />
              <h3 class="text-lg font-semibold text-white mb-2">{{ candidate.name }}</h3>
              <div class="bg-gray-800 p-3 rounded-md w-full">
                <p class="text-sm text-gray-300">{{ candidate.manifesto }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Vote Action (if election is active) -->
      <div
        v-if="isElectionActive"
        class="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center"
      >
        <h2 class="text-xl font-semibold text-white mb-4">Ready to Vote?</h2>

        <div
          v-if="election.isPrivate && !isVerified"
          class="bg-yellow-900/30 border border-yellow-900 rounded-md p-4 mb-4"
        >
          <p class="text-yellow-400 flex items-center justify-center gap-2">
            <AlertTriangle class="h-5 w-5" />
            <span>You must verify your whitelist status before voting</span>
          </p>
        </div>

        <div
          v-else-if="!userAddress"
          class="bg-yellow-900/30 border border-yellow-900 rounded-md p-4 mb-4"
        >
          <p class="text-yellow-400 flex items-center justify-center gap-2">
            <AlertTriangle class="h-5 w-5" />
            <span>Connect your wallet to vote</span>
          </p>
        </div>

        <button
          :disabled="(election.isPrivate && !isVerified) || !userAddress"
          class="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
          @click="() => router.push(`/election/${election.id}/vote`)"
        >
          Proceed to Vote
        </button>
      </div>
    </div>

    <!-- Wallet Connection Modal -->
    <div
      v-if="showWalletConnect"
      class="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50"
      @click.self="showWalletConnect = false"
    >
      <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-bold text-white">Connect Wallet</h2>
            <button @click="showWalletConnect = false" class="text-gray-400 hover:text-white">
              <XCircle class="h-6 w-6" />
            </button>
          </div>

          <div class="space-y-4">
            <p class="text-gray-300 mb-4">
              Connect your wallet to verify your identity for this election. Your wallet address
              will only be used to check if you're on the whitelist.
            </p>

            <div class="flex flex-col gap-3">
              <button
                @click="connectWallet"
                class="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors"
              >
                <Fingerprint class="h-5 w-5" />
                <span>Connect Wallet</span>
              </button>

              <button
                @click="showWalletConnect = false"
                class="px-4 py-2 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
