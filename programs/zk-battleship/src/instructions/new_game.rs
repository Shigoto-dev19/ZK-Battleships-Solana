use crate::state::game::*;
use anchor_lang::prelude::*;

pub fn new_game(
    ctx: Context<NewGame>,  
    host_data: HostBoardData,
) -> Result<()> {
    let game = &mut ctx.accounts.game;
    game.new_game(
        ctx.accounts.player1_host.key(),
        host_data,            
    )
        
}

#[derive(Accounts)]
pub struct NewGame<'info> {
    #[account(init, payer = player1_host, space = Game::MAXIMUM_SIZE)]
    pub game: Account<'info, Game>,
    #[account(mut)]
    pub player1_host: Signer<'info>,
    pub system_program: Program<'info, System>,
}

