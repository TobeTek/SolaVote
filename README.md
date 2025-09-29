# SolaVote: Secure, Scalable, Transparent Elections on Solana

SolaVote combines the speed and security of the **Solana** blockchain with **Homomorphic Encryption**, **Merkle Proofs**, **Cloudflare AI** for secure, verifiable, and transparent electronic voting.

## 🚀 Getting Started

Follow these steps to set up and run both the client-side UI and the Solana smart contract program.

### Prerequisites

You'll need **Node.js**, **Rust/Cargo**, the **Solana Tool Suite**, and the **Anchor Framework** installed.

### 1\. Program Setup

We use `pnpm` as our package manager. Install and enable it using `corepack`, then install dependencies and start the UI:

1.  Enable Corepack:
    ```bash
    corepack enable
    ```
2.  Install `pnpm`:
    ```bash
    corepack install pnpm
    ```
3.  Install dependencies:
    ```bash
    pnpm install
    ```
4.  Start the local development server for the SolaVote UI:
    ```bash
    pnpm run dev
    ```

-----

## 2\. Smart Contract Commands

The smart contract code is in the `solavote-contracts` directory. Use the `anchor` tool for development:

1.  Navigate to the contract directory and compile the Solana program:
    ```bash
    cd solavote-contracts && anchor build
    ```
2.  Run the unit tests for the Solana program:
    ```bash
    cd solavote-contracts && anchor test
    ```
3.  Deploy the program to a local validator or a specified network:
    ```bash
    cd solavote-contracts && anchor deploy
    ```

-----

## ⚙️ Key Technical Details

### Solana Program ID

This is the public key for the deployed SolaVote program on the DevNet:

**Solana Program ID:** [`Dq6vwtM2ZtcXXJPbWDy6mTCgwJpZ4CKssYQXz1XimMz6`](https://solscan.io/account/Dq6vwtM2ZtcXXJPbWDy6mTCgwJpZ4CKssYQXz1XimMz6?cluster=devnet)

-----

## 🌐 Project Links

| Resource | URL |
| :--- | :--- |
| **Live Project UI URL** | [`https://sola-vote.tobe-tek.workers.dev/`](https://sola-vote.tobe-tek.workers.dev) |
| **Pitch Document URL** | [`https://drive.google.com/file/d/1ZDnyij1iCxGWnWDI92lurcmKpW54-vGR/view?usp=sharing`](https://drive.google.com/file/d/1ZDnyij1iCxGWnWDI92lurcmKpW54-vGR/view?usp=sharing) |
| **Demo Video URL** | [`https://drive.google.com/file/d/1vu3-A8n4MUj8HzNpuvflh5h6rKz9eC7R/view?usp=sharing`](https://drive.google.com/file/d/1vu3-A8n4MUj8HzNpuvflh5h6rKz9eC7R/view?usp=sharing) |
| **Pitch Video URL** | [`https://drive.google.com/file/d/1o0E8NXIlDJ5ZtajeHwBOp3w3GaLF7YwO/view?usp=sharing`](https://drive.google.com/file/d/1o0E8NXIlDJ5ZtajeHwBOp3w3GaLF7YwO/view?usp=sharing) |