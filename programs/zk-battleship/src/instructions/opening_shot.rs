use crate::errors::ZKBattleshipError;
use crate::state::game::*;
use anchor_lang::prelude::*;

pub fn play_opening_shot(
    ctx: Context<OpeningShot>, 
    shot: OpeningShotData
) -> Result<()> {

    let game = &mut ctx.accounts.game;

    require_keys_eq!(
        game.current_player(),
        ctx.accounts.player.key(),
        ZKBattleshipError::OnlyHostOpeningShot
    );

    game.play_opening_shot(shot)
}


#[derive(Accounts)]
pub struct OpeningShot<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    pub player: Signer<'info>,
}

