use crate::state::game::*;
use anchor_lang::prelude::*;

pub fn join_game(
    ctx: Context<JoinGame>, 
    joiner_data: JoinerBoardData,
   
) -> Result<()> {
    let game = &mut ctx.accounts.game;
    game.join_game(
        ctx.accounts.player2_joiner.key(),
        joiner_data, 
    )
}

#[derive(Accounts)]
pub struct JoinGame<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    pub player2_joiner: Signer<'info>,
}
