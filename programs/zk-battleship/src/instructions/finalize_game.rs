use crate::errors::ZKBattleshipError;
use crate::state::game::*;
use anchor_lang::prelude::*;

 /// Delete the game account.
pub fn delete_game_account<'info>(
    _ctx: Context<CloseGameAccount>,
) -> Result<()> {
    let game = &mut _ctx.accounts.game;
    require!(game.is_player(
        _ctx.accounts.signing_address.key()), 
        ZKBattleshipError::GameStillOngoing
    );
    
    Ok(())
}

#[derive(Accounts)]
pub struct CloseGameAccount<'info> {
    #[account(mut)]
    pub signing_address: Signer<'info>,
    #[account(mut, close=signing_address )]
    pub game: Account<'info, Game>,
}

