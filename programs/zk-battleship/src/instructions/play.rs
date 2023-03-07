use crate::errors::ZKBattleshipError;
use crate::state::game::*;
use anchor_lang::prelude::*;

pub fn play(ctx: Context<Play>, data: &PlayerTurnData) -> Result<()> {
    let game = &mut ctx.accounts.game;

    require_keys_eq!(
        game.current_player(),
        ctx.accounts.player.key(),
        ZKBattleshipError::NotPlayersTurn
    );

    game.play(&data)
}

#[derive(Accounts)]
pub struct Play<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    pub player: Signer<'info>,
}