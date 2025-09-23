use anchor_lang::prelude::*;

declare_id!("Dq6vwtM2ZtcXXJPbWDy6mTCgwJpZ4CKssYQXz1XimMz6");

#[program]
pub mod solavote_contracts {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
