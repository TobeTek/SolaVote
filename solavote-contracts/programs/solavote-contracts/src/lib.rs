mod merkle_proof;

use anchor_lang::prelude::*;
use anchor_spl::token_2022;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use merkle_proof::verify_merkle_proof;
use sha2::{Digest, Sha256};

declare_id!("Dq6vwtM2ZtcXXJPbWDy6mTCgwJpZ4CKssYQXz1XimMz6");

#[program]
pub mod solavote_program {
    use super::*;

    pub fn create_election(
        ctx: Context<CreateElection>,
        title: String,
        is_private: bool,
        public_key: Option<[u8; 32]>, // Encryption pubkey if private ballot
    ) -> Result<()> {
        let election = &mut ctx.accounts.election;
        election.authority = *ctx.accounts.creator.key;
        election.title = title;
        election.is_private = is_private;
        election.public_key = public_key;
        election.merkle_root = None;
        election.open = false;
        election.bump = ctx.bumps.election;
        election.voter_count = 0;
        election.admins = vec![*ctx.accounts.creator.key];
        Ok(())
    }

    pub fn start_election(
        ctx: Context<StartElection>,
        merkle_root: Option<[u8; 32]>,
    ) -> Result<()> {
        let election = &mut ctx.accounts.election;
        require!(
            election.admins.contains(ctx.accounts.authority.key),
            VotingError::Unauthorized
        );
        election.merkle_root = merkle_root;
        election.open = true;
        Ok(())
    }

    pub fn cast_vote(
        ctx: Context<CastVote>,
        encrypted_vote: Vec<u8>,
        merkle_proof: Option<Vec<[u8; 32]>>,
    ) -> Result<()> {
        let voter_record = &mut ctx.accounts.voter_record;
        let election = &ctx.accounts.election;

        require!(election.open, VotingError::VotingClosed);
        require!(!voter_record.has_voted, VotingError::AlreadyVoted);

        if election.is_private {
            let proof = merkle_proof.ok_or(VotingError::ProofRequired)?;

            let mut hasher = Sha256::new();
            hasher.update(ctx.accounts.voter.key().to_bytes());
            let result = hasher.finalize();
            let leaf = result.as_slice().try_into();
            let verified =
                verify_merkle_proof(leaf.unwrap(), &election.merkle_root.unwrap(), &proof);
            require!(verified, VotingError::ProofInvalid);
        }

        voter_record.election = election.key();
        voter_record.voter = *ctx.accounts.voter.key;
        voter_record.has_voted = true;
        voter_record.bump = ctx.bumps.voter_record;

        let vote_data = &mut ctx.accounts.vote_data;
        vote_data.election = election.key();
        vote_data.voter = *ctx.accounts.voter.key;
        vote_data.encrypted_vote = encrypted_vote;
        vote_data.bump = ctx.bumps.vote_data;

        // Mint NFT as proof of voting; assumes NFT token account (ATA) exists for user
        // Use the mint authority PDA's seeds for signing the CPI
        let binding = election.key();
        let mint_seeds = &[b"nft-mint", binding.as_ref(), &[ctx.bumps.nft_mint]];
        let mint_signer_seeds = &[mint_seeds as &[&[u8]]];
        let cpi_accounts = token_2022::MintTo {
            mint: ctx.accounts.nft_mint.to_account_info(),
            to: ctx.accounts.nft_token_account.to_account_info(),
            authority: ctx.accounts.mint_authority.to_account_info(),
        };

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            mint_signer_seeds,
        );

        token_2022::mint_to(cpi_ctx, 1)?;

        Ok(())
    }

    pub fn close_election(ctx: Context<CloseElection>) -> Result<()> {
        let election = &mut ctx.accounts.election;
        require!(
            election.admins.contains(ctx.accounts.admin.key),
            VotingError::Unauthorized
        );
        election.open = false;
        Ok(())
    }

    pub fn add_admin(ctx: Context<ManageAdmins>, new_admin: Pubkey) -> Result<()> {
        let election = &mut ctx.accounts.election;
        require!(
            election.admins.contains(ctx.accounts.admin.key),
            VotingError::Unauthorized
        );
        if !election.admins.contains(&new_admin) {
            election.admins.push(new_admin);
        }
        Ok(())
    }
}

// Account structs extended with admins list for multi-admin
#[account]
pub struct Election {
    pub authority: Pubkey,
    pub title: String,
    pub is_private: bool,
    pub merkle_root: Option<[u8; 32]>,
    pub public_key: Option<[u8; 32]>,
    pub voter_count: u64,
    pub open: bool,
    pub bump: u8,
    pub admins: Vec<Pubkey>, // Election admins who can whitelist and start election
}

#[account]
pub struct VoterRecord {
    pub election: Pubkey,
    pub voter: Pubkey,
    pub has_voted: bool,
    pub bump: u8,
}

#[account]
pub struct VoteData {
    pub election: Pubkey,
    pub voter: Pubkey,
    pub encrypted_vote: Vec<u8>,
    pub bump: u8,
}

// Contexts

#[derive(Accounts)]
#[instruction(title: String, is_private: bool)]
pub struct CreateElection<'info> {
    #[account(init, payer = creator, space = 8 + Election::MAX_SIZE, seeds = [b"election", creator.key.as_ref(), title.as_bytes()], bump)]
    pub election: Account<'info, Election>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StartElection<'info> {
    #[account(mut, has_one = authority)]
    pub election: Account<'info, Election>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        mint::decimals = 0,
        mint::authority = nft_mint,
        seeds = [b"nft-mint", election.key().as_ref()],
        bump,
    )]
    pub nft_mint: InterfaceAccount<'info, Mint>,

    /// CHECK: This PDA's address is used as the mint authority in the mint::authority constraint above.
    /// It is deterministically derived from the election key, and is not read from or written to directly.
    #[account(
        seeds = [b"nft-mint", election.key().as_ref()], 
        bump,
    )]
    pub mint_authority: AccountInfo<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub election: Account<'info, Election>,
    #[account(
        init,
        payer = voter,
        space = 8 + VoterRecord::MAX_SIZE,
        seeds = [b"voter-record", voter.key().as_ref(), election.key().as_ref()],
        bump
    )]
    pub voter_record: Account<'info, VoterRecord>,
    #[account(init, payer = voter, space = 8 + VoteData::MAX_SIZE, seeds = [b"vote", election.key().as_ref(), voter.key().as_ref()], bump)]
    pub vote_data: Account<'info, VoteData>,
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(
        mut,
        seeds = [b"nft-mint", election.key().as_ref()],
        bump,
    )]
    pub nft_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub nft_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: This PDA's address is used as the mint authority in the mint::authority constraint above.
    /// It is deterministically derived from the election key, and is not read from or written to directly.
    #[account(mut,
        seeds = [b"nft-mint", election.key().as_ref()], 
        bump,
    )]
    pub mint_authority: AccountInfo<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CloseElection<'info> {
    #[account(mut)]
    pub election: Account<'info, Election>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct ManageAdmins<'info> {
    #[account(mut)]
    pub election: Account<'info, Election>,
    pub admin: Signer<'info>,
}

// Size calculations (adjusted for admins Vec<Pubkey>)
impl Election {
    pub const MAX_TITLE_LEN: usize = 64;
    pub const MAX_ADMINS: usize = 3;
    pub const MAX_SIZE: usize =
        32 + 4 + Self::MAX_TITLE_LEN + 1 + 4 + 32 + 4 + 32 + 8 + 1 + 1 + 4 + Self::MAX_ADMINS * 32;
}

impl VoterRecord {
    pub const MAX_SIZE: usize = 32 + 32 + 1 + 1;
}

impl VoteData {
    pub const MAX_ENCRYPTED_VOTE_LEN: usize = 512;
    pub const MAX_SIZE: usize = 32 + 32 + 4 + Self::MAX_ENCRYPTED_VOTE_LEN + 1;
}

// Errors

#[error_code]
pub enum VotingError {
    #[msg("Voting is closed.")]
    VotingClosed,
    #[msg("You have already voted.")]
    AlreadyVoted,
    #[msg("Whitelist proof is required for this election.")]
    ProofRequired,
    #[msg("Whitelist proof is invalid.")]
    ProofInvalid,
    #[msg("Unauthorized action.")]
    Unauthorized,
}

#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::prelude::Pubkey;

    fn dummy_pubkey() -> Pubkey {
        Pubkey::from_str_const("BPFLoaderUpgradeab1e11111111111111111111111")
    }

    fn create_default_election() -> Election {
        Election {
            authority: dummy_pubkey(),
            title: "Test Election".to_string(),
            is_private: false,
            merkle_root: None,
            public_key: None,
            voter_count: 0,
            open: false,
            bump: 1,
            admins: vec![dummy_pubkey()],
        }
    }

    #[test]
    fn test_create_election_sets_fields() {
        let title = "Election Title".to_string();
        let is_private = true;
        let pubkey = Some([0u8; 32]);

        let mut election_obj = create_default_election();
        election_obj.title = title.clone();
        election_obj.is_private = is_private;
        election_obj.public_key = pubkey;

        assert_eq!(election_obj.title, title);
        assert!(election_obj.is_private);
        assert_eq!(election_obj.public_key, pubkey);
    }

    #[test]
    fn test_add_admin_adds_new_admin() {
        let mut election = create_default_election();
        let new_admin = Pubkey::new_unique();

        assert!(!election.admins.contains(&new_admin));
        election.admins.push(new_admin);
        assert!(election.admins.contains(&new_admin));
    }

    #[test]
    fn test_start_election_authorized() {
        let mut election = create_default_election();
        let admin = election.admins[0];
        assert!(election.admins.contains(&admin));
        election.open = false;
        let merkle_root = Some([0u8; 32]);

        election.merkle_root = merkle_root;
        election.open = true;

        assert!(election.open);
        assert_eq!(election.merkle_root, merkle_root);
    }

    #[test]
    fn test_verify_merkle_proof() {
        let leaf: [u8; 32] = [0u8; 32];
        let root: [u8; 32] = leaf;
        let proof: Vec<[u8; 32]> = vec![];

        let valid = merkle_proof::verify_merkle_proof(&leaf, &root, &proof);
        assert!(valid);
    }
}