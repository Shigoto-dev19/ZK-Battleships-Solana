use crate::errors::ZKBattleshipError;
use anchor_lang::prelude::*;

//type EncryptionObject = [[u8;32]; 5];

#[account]
pub struct Game {

    players: [Pubkey; 2],     
    encryption_pk: [[[u8;32];2]; 2],  
    shared_keys: [[u8;32]; 2],          
    boards: [[u8;32]; 2],        
    joinable: bool,             
    turns: u8,                  
    shots: Vec<[u8;2]>,  
    hits: Vec<u8>,
    hit_count: [u8; 2],
    state: GameState           

}

impl Game {

    pub const MAXIMUM_SIZE: usize = 2048;

    pub fn new_game(
        &mut self, 
        player1_host: Pubkey, 
        host_data: HostBoardData
    ) -> Result<()> {

        // require!(verifyBoardProof, ZKBattleshipError::BoardZKVerificationFailed);
        // self.game_id += 1;
        self.players[0] = player1_host;
        self.boards[0] = host_data.board_hash;
        self.encryption_pk[0] = host_data.host_encryption_pubkey;
        self.joinable = true;

        Ok(())
    
    }

    pub fn join_game(
        &mut self, 
        player2_joiner: Pubkey,
        joiner_data: JoinerBoardData
    ) -> Result<()> {
        
        // require!(verifyBoardProof, ZKBattleshipError::BoardZKVerificationFailed);
        require!(self.joinable, ZKBattleshipError::GameNotJoinable);
        self.players[1] = player2_joiner;
        self.boards[1] = joiner_data.board_hash;
        self.encryption_pk[1] = joiner_data.joiner_encryption_pubkey;
        self.joinable = false;

        self.state = GameState::ReadyToStart;

        Ok(())
    }
  
    pub fn is_ongoing(&self) -> bool {
        self.state == GameState::Ongoing
    }

    fn player_turn(&self) -> usize {
        ((self.turns) % 2) as usize
    }

    pub fn turn_count(&self) -> usize {
        self.turns as usize
    }

    fn is_ready_to_start(&self) -> bool {
        self.state == GameState::ReadyToStart
    }

    pub fn current_player(&self) -> Pubkey {
        self.players[self.player_turn()]
    }

    pub fn play_opening_shot(
        &mut self, 
        shot: OpeningShotData
    ) -> Result<()> {
        require_eq!(self.turns, 0, ZKBattleshipError::GameAlreadyStarted);
        require!(self.is_ready_to_start(), ZKBattleshipError::GameAlreadyStarted);
        //require_eq!(self.players, msg.sender, ZKBattleshipError::OnlyHostCanStartTheGame);
        self.shots[self.turns as usize] = shot.shot;
        self.turns = 1;
        self.state = GameState::Ongoing;

        Ok(())
    }
    
    /*pub fn play(&mut self, data: &PlayerTurnData) {
        
        require_eq!(self.state,GameState::Ongoing, ZKBattleshipError::GameAlreadyOver);
        // require!(verifyShotProof, ZKBattleshipError::ShotZKVerificationFailed);
        // require!(verifyWinnerProof, ZKBattleshipError::WinnerZKVerificationFailed);
        self.hits[self.turns - 1] = data.enemy_hit_encrypted;
        self.hit_count[(self.turns - 1) % 2] = data.enemy_hit_count_encrypted;
        if data.winner_public_signals[0] == true {
            self.state = GameState::Won {
                winner: self.current_player(),
            };
            return;
        } else {
            self.shots[self.turns] = data.player_shot_encrypted;
            self.turns += 1;
        }

        Ok(())
    }*/

}


#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum GameState {
    ReadyToStart,
    Ongoing,
    Finished,
    Won { winner: Pubkey },
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct HostBoardData {
    board_hash: [u8;32],
    host_encryption_pubkey: [[u8;32];2],
    
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct JoinerBoardData {
    board_hash: [u8;32],
    joiner_encryption_pubkey: [[u8;32];2]
}

#[derive(AnchorSerialize, AnchorDeserialize, Copy, Clone, PartialEq, Eq)]
pub struct OpeningShotData {
    
    shot: [u8; 2],
}
/* 
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct PlayerTurnData {
    game_id: u16,
    player_shot_encrypted: EncryptionObject,
    shot_proof: Vec<EncryptionObject>,
    enemy_hit_encrypted: EncryptionObject,
    enemy_hit_count_encrypted: EncryptionObject,
    winner_proof: Vec<EncryptionObject>,
    winner_public_signals: Vec<EncryptionObject>,
}
*/