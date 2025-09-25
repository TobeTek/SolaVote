import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { sha256 } from '@coral-xyz/anchor/dist/cjs/utils'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token'
import { Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import { Buffer } from 'buffer'
import chai, { expect } from 'chai'
import { MerkleTree } from 'merkletreejs'

import { SolavoteProgram } from '../target/types/solavote_program'

describe('solavote_program integration tests', () => {
  anchor.setProvider(anchor.AnchorProvider.env())
  const program = anchor.workspace.SolavoteProgram as Program<SolavoteProgram>
  const provider = program.provider as anchor.AnchorProvider
  const wallet = provider.wallet

  const electionTitle = 'Integration Test Election'
  const creator = wallet.publicKey

  let electionPda: PublicKey, electionBump: number
  let nftMint: PublicKey, mintAuthority: PublicKey

  let voter: Keypair
  let voterRecordPda: PublicKey
  let voteDataPda: PublicKey
  let nftTokenAccount: PublicKey

  before(async () => {
    const chaiAsPromised = await import('chai-as-promised')
    chai.use(chaiAsPromised.default)
    ;[electionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('election'), creator.toBuffer(), Buffer.from(electionTitle)],
      program.programId
    )
    ;[nftMint] = PublicKey.findProgramAddressSync(
      [Buffer.from('nft-mint'), electionPda.toBuffer()],
      program.programId
    )
    ;[mintAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('nft-mint'), electionPda.toBuffer()],
      program.programId
    )

    voter = Keypair.generate()
    ;[voterRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('voter-record'), voter.publicKey.toBuffer(), electionPda.toBuffer()],
      program.programId
    )
    ;[voteDataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vote'), electionPda.toBuffer(), voter.publicKey.toBuffer()],
      program.programId
    )

    nftTokenAccount = getAssociatedTokenAddressSync(
      nftMint,
      voter.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )

    // Fund voter
    const sig = await provider.connection.requestAirdrop(voter.publicKey, 1e9)
    await provider.connection.confirmTransaction(sig)
  })

  it('creates an election', async () => {
    await program.methods
      .createElection(electionTitle, false, null)
      .accounts({
        election: electionPda,
        creator,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

    const election = await program.account.election.fetch(electionPda)
    expect(election.title).to.equal(electionTitle)
    expect(election.open).to.be.false
    expect(election.isPrivate).to.be.false
    expect(election.admins.map((k) => k.toBase58())).to.include(creator.toBase58())
  })

  it('starts the election', async () => {
    await program.methods
      .startElection(null)
      .accounts({
        election: electionPda,
        authority: creator,
        nftMint,
        mintAuthority,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc()

    const election = await program.account.election.fetch(electionPda)
    expect(election.open).to.be.true
    expect(election.merkleRoot).to.be.null
  })

  it('casts a vote and mints NFT', async () => {
    const encryptedVote = Buffer.from('encrypted-vote-data')
    // 1. Define the parameters for the instruction
    const payer = voter.publicKey // Voter pays for the ATA rent
    const owner = voter.publicKey // Voter owns the new ATA
    const mint = nftMint // The NFT Mint address
    const associatedToken = nftTokenAccount // The derived ATA address

    // 2. Construct the CreateAssociatedTokenAccount instruction
    const createAtaInstruction = createAssociatedTokenAccountInstruction(
      payer,
      associatedToken,
      owner,
      mint,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )

    // 3. Build and send a separate transaction to create the ATA
    const createAtaTx = new Transaction().add(createAtaInstruction)

    // The transaction must be signed by the payer (voter)
    await provider.sendAndConfirm(createAtaTx, [voter])

    // Check if the ATA exists before proceeding (optional but good for robustness)
    const ataAccountInfo = await provider.connection.getAccountInfo(nftTokenAccount)
    expect(ataAccountInfo).to.not.be.null
    await program.methods
      .castVote(encryptedVote, null)
      .accounts({
        election: electionPda,
        voterRecord: voterRecordPda,
        voteData: voteDataPda,
        voter: voter.publicKey,
        nftMint,
        nftTokenAccount,
        mintAuthority,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([voter])
      .rpc()

    const voteData = await program.account.voteData.fetch(voteDataPda)
    expect(Buffer.from(voteData.encryptedVote).toString()).to.equal(encryptedVote.toString())

    const voterRecord = await program.account.voterRecord.fetch(voterRecordPda)
    expect(voterRecord.hasVoted).to.be.true

    const nftAccountInfo = await provider.connection.getTokenAccountBalance(nftTokenAccount)
    expect(parseInt(nftAccountInfo.value.amount)).to.be.greaterThan(0)
  })

  it('rejects double voting', async () => {
    const encryptedVote = Buffer.from('attempt-twice')
    await expect(
      program.methods
        .castVote(encryptedVote, null)
        .accounts({
          election: electionPda,
          voterRecord: voterRecordPda,
          voteData: voteDataPda,
          voter: voter.publicKey,
          nftMint,
          nftTokenAccount,
          mintAuthority,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([voter])
        .rpc()
    ).to.be.rejectedWith(/AlreadyVoted/)
  })

  it('closes the election', async () => {
    await program.methods
      .closeElection()
      .accounts({
        election: electionPda,
        admin: creator,
      })
      .rpc()

    const election = await program.account.election.fetch(electionPda)
    expect(election.open).to.be.false
  })

  it('rejects voting after election is closed', async () => {
    const newVoter = Keypair.generate()
    const [newVoterRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('voter-record'), newVoter.publicKey.toBuffer(), electionPda.toBuffer()],
      program.programId
    )
    const [newVoteDataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vote'), electionPda.toBuffer(), newVoter.publicKey.toBuffer()],
      program.programId
    )
    const newNftTokenAccount = await anchor.utils.token.associatedAddress({
      mint: nftMint,
      owner: newVoter.publicKey,
    })

    // Fund new voter
    const sig = await provider.connection.requestAirdrop(newVoter.publicKey, 1e9)
    await provider.connection.confirmTransaction(sig)

    const encryptedVote = Buffer.from('vote-after-close')
    await expect(
      program.methods
        .castVote(encryptedVote, null)
        .accounts({
          election: electionPda,
          voterRecord: newVoterRecordPda,
          voteData: newVoteDataPda,
          voter: newVoter.publicKey,
          nftMint,
          nftTokenAccount: newNftTokenAccount,
          mintAuthority,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([newVoter])
        .rpc()
    ).to.be.rejectedWith(/VotingClosed/)
  })

  it('adds a new admin', async () => {
    const newAdmin = Keypair.generate()
    await program.methods
      .addAdmin(newAdmin.publicKey)
      .accounts({
        election: electionPda,
        admin: creator,
      })
      .rpc()
    const election = await program.account.election.fetch(electionPda)
    expect(election.admins.some((a) => a.equals(newAdmin.publicKey))).to.be.true
  })
})

describe('Private Election with Merkle Proofs', () => {
  anchor.setProvider(anchor.AnchorProvider.env())
  const program = anchor.workspace.SolavoteProgram as Program<SolavoteProgram>
  const provider = program.provider as anchor.AnchorProvider
  const wallet = provider.wallet

  const electionTitle = 'Private Election'
  const creator = wallet.publicKey

  let electionPda: PublicKey
  let nftMint: PublicKey
  let mintAuthority: PublicKey

  // Helper: Merkle hashing (using sha256 as bytes)
  function hashVoter(voterPubkey: PublicKey): Buffer {
    const pkBytes = Buffer.from(voterPubkey.toBytes())
    return Buffer.from(sha256.hash(pkBytes).toString(), 'hex')
  }

  let voters: Keypair[] = []
  let merkleTree: MerkleTree
  let merkleRoot: Buffer

  before(async () => {
    ;[electionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('election'), creator.toBuffer(), Buffer.from(electionTitle)],
      program.programId
    )
    ;[nftMint] = PublicKey.findProgramAddressSync(
      [Buffer.from('nft-mint'), electionPda.toBuffer()],
      program.programId
    )
    ;[mintAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('nft-mint'), electionPda.toBuffer()],
      program.programId
    )

    voters = []
    for (let i = 0; i < 4; i++) {
      const voter = Keypair.generate()
      voters.push(voter)
      const sig = await provider.connection.requestAirdrop(voter.publicKey, 1e9)
      await provider.connection.confirmTransaction(sig)

      // 1. Define the parameters for the instruction
      const payer = voter.publicKey // Voter pays for the ATA rent
      const owner = voter.publicKey // Voter owns the new ATA
      const mint = nftMint // The NFT Mint address
      const associatedToken = nftTokenAccount // The derived ATA address

      // 2. Construct the CreateAssociatedTokenAccount instruction
      const createAtaInstruction = createAssociatedTokenAccountInstruction(
        payer,
        associatedToken,
        owner,
        mint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )

      // 3. Build and send a separate transaction to create the ATA
      const createAtaTx = new Transaction().add(createAtaInstruction)

      // The transaction must be signed by the payer (voter)
      await provider.sendAndConfirm(createAtaTx, [voter])

      // Check if the ATA exists before proceeding (optional but good for robustness)
      const ataAccountInfo = await provider.connection.getAccountInfo(nftTokenAccount)
      expect(ataAccountInfo).to.not.be.null
    }

    // Build Merkle tree
    const leaves = voters.map((kp) => hashVoter(kp.publicKey))
    merkleTree = new MerkleTree(leaves, (d) => sha256.hash(d), { sortPairs: true })
    merkleRoot = merkleTree.getRoot()

    // Create Private Election
    await program.methods
      .createElection(electionTitle, true, null)
      .accounts({
        election: electionPda,
        creator,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

    // Start election with Merkle root
    await program.methods
      .startElection(Array.from(merkleRoot))
      .accounts({
        election: electionPda,
        authority: creator,
        nftMint,
        mintAuthority,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc()
  })

  it('allows voting for a whitelisted voter (valid proof)', async () => {
    const voter = voters[0]
    const [voterRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('voter-record'), voter.publicKey.toBuffer(), electionPda.toBuffer()],
      program.programId
    )
    const [voteDataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vote'), electionPda.toBuffer(), voter.publicKey.toBuffer()],
      program.programId
    )
    const nftTokenAccount = await anchor.utils.token.associatedAddress({
      mint: nftMint,
      owner: voter.publicKey,
    })
    // Generate Merkle proof
    const proof = merkleTree.getProof(hashVoter(voter.publicKey)).map((p) => p.data)
    const encryptedVote = Buffer.from('valid-private-vote')

    await program.methods
      .castVote(encryptedVote, proof)
      .accounts({
        election: electionPda,
        voterRecord: voterRecordPda,
        voteData: voteDataPda,
        voter: voter.publicKey,
        nftMint,
        nftTokenAccount,
        mintAuthority,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([voter])
      .rpc()

    const voterRecord = await program.account.voterRecord.fetch(voterRecordPda)
    expect(voterRecord.hasVoted).to.be.true
    const voteData = await program.account.voteData.fetch(voteDataPda)
    expect(Buffer.from(voteData.encryptedVote).toString()).to.equal('valid-private-vote')
    const nftAccountInfo = await provider.connection.getTokenAccountBalance(nftTokenAccount)
    expect(parseInt(nftAccountInfo.value.amount)).to.be.greaterThan(0)
  })

  it('rejects voting with invalid Merkle proof', async () => {
    const invalidVoter = Keypair.generate()
    const [voterRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('voter-record'), invalidVoter.publicKey.toBuffer(), electionPda.toBuffer()],
      program.programId
    )
    const [voteDataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vote'), electionPda.toBuffer(), invalidVoter.publicKey.toBuffer()],
      program.programId
    )
    const nftTokenAccount = await anchor.utils.token.associatedAddress({
      mint: nftMint,
      owner: invalidVoter.publicKey,
    })
    const sig = await provider.connection.requestAirdrop(invalidVoter.publicKey, 1e9)
    await provider.connection.confirmTransaction(sig)

    const encryptedVote = Buffer.from('fake-vote')
    const fakeProof = [Buffer.alloc(32, 1), Buffer.alloc(32, 2)]

    await expect(
      program.methods
        .castVote(encryptedVote, fakeProof)
        .accounts({
          election: electionPda,
          voterRecord: voterRecordPda,
          voteData: voteDataPda,
          voter: invalidVoter.publicKey,
          nftMint,
          nftTokenAccount,
          mintAuthority,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([invalidVoter])
        .rpc()
    ).to.be.rejectedWith(/ProofInvalid/)
  })
})
