use anchor_lang::prelude::*;
use instructions::*;
use state::game::HostBoardData;
use state::game::JoinerBoardData;
use state::game::OpeningShotData;
use state::game::PlayerTurnData;

pub mod board_verifying_key;
pub mod shot_verifying_key;
pub mod errors;
pub mod instructions;
pub mod state;

declare_id!("5Jt2pEktgDMHWpy6aEUVx5Kt7XfLKpA1oahAyoLA7i98");

#[program]
pub mod zk_battleship {
    use super::*;
    
    pub fn new_game(
        ctx: Context<NewGame>, 
        host_data: HostBoardData,
        
    ) -> Result<()> {
        instructions::new_game::new_game(
            ctx, 
            host_data,
        )
    }

    pub fn join_game(
        ctx: Context<JoinGame>,
        joiner_data: JoinerBoardData,
        
    ) -> Result<()> {
        instructions::join_game::join_game(
            ctx,
            joiner_data,
        )
    }

    pub fn play_opening_shot(
        ctx: Context<OpeningShot>, 
        shot: OpeningShotData
    ) -> Result<()> {
        instructions::opening_shot::play_opening_shot(ctx, shot)
    }

    pub fn play(
        ctx: Context<Play>, 
        player_data: PlayerTurnData
    ) -> Result<()> {
        instructions::play::play(ctx, player_data)
    }

    pub fn finalize_game(
        ctx: Context<CloseGameAccount>
    ) -> Result<()> {
        instructions::finalize_game::delete_game_account(ctx)
    }
    
}
