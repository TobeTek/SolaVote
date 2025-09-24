import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { expect } from 'chai'
import { solavote_program } from '../target/types/solavote_program'
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";

describe('solavote_program integration tests', () => {
  anchor.setProvider(anchor.AnchorProvider.env())
  const program = anchor.workspace.SolavoteProgram as Program<solavote_program>
  const provider = program.provider as anchor.AnchorProvider
  const wallet = provider.wallet

  const electionTitle = 'Integration Test Election'
  const creator = wallet.publicKey

  let electionPda: PublicKey
  let electionBump: number

  let voter: Keypair
  let voterRecordPda: PublicKey

  let voteDataPda: PublicKey

  let nftMint: PublicKey
  let nftTokenAccount: PublicKey
  let mintAuthority: PublicKey

  // Mock Merkle tree proof setup for private election test
  // For simplicity, we will assume empty proof and root equal to voter's pubkey hash for valid test

  const dummyMerkleRoot = new Uint8Array(32)
  const dummyProof: Uint8Array[] = []

  before(async () => {
    // Derive Election PDA
    ;[electionPda, electionBump] = await PublicKey.findProgramAddress(
      [Buffer.from('election'), creator.toBuffer(), Buffer.from(electionTitle)],
      program.programId
    )

    // Voter keypair and PDAs
    voter = Keypair.generate()

    ;[voterRecordPda] = await PublicKey.findProgramAddress(
      [Buffer.from('voter_record'), electionPda.toBuffer(), voter.publicKey.toBuffer()],
      program.programId
    )

    ;[voteDataPda] = await PublicKey.findProgramAddress(
      [Buffer.from('vote'), electionPda.toBuffer(), voter.publicKey.toBuffer()],
      program.programId
    )

    // NFT mint and mint authority PDA
    nftMint = Keypair.generate().publicKey

    ;[mintAuthority] = await PublicKey.findProgramAddress(
      [
        Buffer.from('election'),
        creator.toBuffer(),
        Buffer.from(electionTitle),
        Buffer.from([electionBump]),
      ],
      program.programId
    )

    nftTokenAccount = await anchor.utils.token.associatedAddress({
      mint: nftMint,
      owner: voter.publicKey,
    })

    // Airdrop some SOL to new voter to pay for tx fees
    const airdropSig = await provider.connection.requestAirdrop(voter.publicKey, 2e9)
    await provider.connection.confirmTransaction(airdropSig)
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
      })
      .rpc()

    const election = await program.account.election.fetch(electionPda)
    expect(election.open).to.be.true
    expect(election.merkleRoot).to.be.null
  })

  it('creates voter record (assumed separate instruction, replace with correct if exists)', async () => {
    // Mock creation: Simulate that the voter record is created.
    // If your program has explicit create_voter_record method, call it here.
    // Otherwise fund voter and assume record exists for simplicity in this test.
  })

  it('casts a vote and mints NFT', async () => {
    const encryptedVote = Buffer.from('encrypted-vote-data')

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

    // Confirm NFT minted to user's token account
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
    ).to.throw(/AlreadyVoted/)
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
    const newVoterRecordPda = (
      await PublicKey.findProgramAddress(
        [Buffer.from('voter_record'), electionPda.toBuffer(), newVoter.publicKey.toBuffer()],
        program.programId
      )
    )[0]

    const newVoteDataPda = (
      await PublicKey.findProgramAddress(
        [Buffer.from('vote'), electionPda.toBuffer(), newVoter.publicKey.toBuffer()],
        program.programId
      )
    )[0]

    // Airdrop new voter for fees
    const airdropSig = await provider.connection.requestAirdrop(newVoter.publicKey, 2e9)
    await provider.connection.confirmTransaction(airdropSig)

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
          nftTokenAccount,
          mintAuthority,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([newVoter])
        .rpc()
    ).to.throw(/VotingClosed/)
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

  // Add tests for private elections with Merkle proofs if needed
})
