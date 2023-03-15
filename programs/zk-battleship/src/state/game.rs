use crate::board_verifying_key::VERIFYINGKEYBOARD;
use crate::shot_verifying_key::VERIFYINGKEYSHOT;

use crate::errors::ZKBattleshipError;
use groth16_solana::groth16::{Groth16Verifier};
use ark_ff::bytes::{FromBytes, ToBytes};
use std::ops::Neg;
use anchor_lang::prelude::*;


#[account]
pub struct Game {

    players: [Pubkey; 2],     
    encryption_pk: [[[u8;32];2]; 2],           
    boards: [[u8;32]; 2],        
    joinable: bool,             
    turns: u16,                  
    shots: [[u8;32]; 5],  
    hits: [[u8;32]; 5],
    state: GameState,          

}

impl Game {

    pub const MAXIMUM_SIZE: usize = 10000;

    /// Verifies a Goth16 zero knowledge proof over the bn254 curve.
    fn board_verifier(
        &self, 
        mut proof_a: [u8; 64],
        proof_b: [u8; 128],
        proof_c: [u8; 64],
        public_signals: [u8; 32]
    ) -> bool {
        
        type G1 = ark_ec::short_weierstrass_jacobian::GroupAffine<ark_bn254::g1::Parameters>;
        fn change_endianness(bytes: &[u8]) -> Vec<u8> {
            let mut vec = Vec::new();
            for b in bytes.chunks(32) {
                for byte in b.iter().rev() {
                    vec.push(*byte);
                }
            }
            vec
        }

        let proof_a_neg_g1: G1 = <G1 as FromBytes>::read(
            &*[&change_endianness(proof_a.as_slice())[..], &[0u8][..]].concat(),
        )
        .unwrap();
        let mut proof_a_neg = [0u8; 65];
        <G1 as ToBytes>::write(&proof_a_neg_g1.neg(), &mut proof_a_neg[..]).unwrap();
        let proof_a_neg = change_endianness(&proof_a_neg[..64]).try_into().unwrap();
        
        let mut public_inputs_vec = Vec::new();
        for input in public_signals.chunks(32) {
            public_inputs_vec.push(input);
        }
        proof_a = proof_a_neg;
        let mut verifier = Groth16Verifier::new(
            &proof_a,
            &proof_b,
            &proof_c,
            &public_inputs_vec.as_slice(),
            &VERIFYINGKEYBOARD,
        )
        .unwrap();
        verifier.verify().unwrap()
    }

    fn shot_verifier(
        &self, 
        mut proof_a: [u8; 64],
        proof_b: [u8; 128],
        proof_c: [u8; 64],
        //mut public_signals: [[u8;32];6]
    ) -> bool {
        
        type G1 = ark_ec::short_weierstrass_jacobian::GroupAffine<ark_bn254::g1::Parameters>;
        fn change_endianness(bytes: &[u8]) -> Vec<u8> {
            let mut vec = Vec::new();
            for b in bytes.chunks(32) {
                for byte in b.iter().rev() {
                    vec.push(*byte);
                }
            }
            vec
        }

        let proof_a_neg_g1: G1 = <G1 as FromBytes>::read(
            &*[&change_endianness(proof_a.as_slice())[..], &[0u8][..]].concat(),
        )
        .unwrap();
        let mut proof_a_neg = [0u8; 65];
        <G1 as ToBytes>::write(&proof_a_neg_g1.neg(), &mut proof_a_neg[..]).unwrap();
        let proof_a_neg = change_endianness(&proof_a_neg[..64]).try_into().unwrap();
        
        let mut public_signals: Vec<[u8; 32]> = Vec::new();
        public_signals.push(self.boards[self.player_turn()]);
        public_signals.extend_from_slice(&self.shots);
        
        let flattened_public_inputs = public_signals.concat();
        let mut public_inputs_vec = Vec::new();
        for input in flattened_public_inputs.chunks(32) {
            public_inputs_vec.push(input);
        }
        proof_a = proof_a_neg;
        let mut verifier = Groth16Verifier::new(
            &proof_a,
            &proof_b,
            &proof_c,
            &public_inputs_vec.as_slice(),
            &VERIFYINGKEYSHOT,
        )
        .unwrap();
        verifier.verify().unwrap()
    }

    pub fn new_game(
        &mut self, 
        player1_host: Pubkey, 
        host_data: HostBoardData,
        
    ) -> Result<()> {

        require!(
            self.board_verifier(
                host_data.proof_a,
                host_data.proof_b,
                host_data.proof_c,
                host_data.board_hash
            ), 
            ZKBattleshipError::BoardZKVerificationFailed
        );
        
        self.players[0] = player1_host;
        self.boards[0] = host_data.board_hash;
        self.encryption_pk[0] = host_data.host_encryption_pubkey;
        self.joinable = true;

        Ok(())
    
    }

    pub fn join_game(
        &mut self, 
        player2_joiner: Pubkey,
        joiner_data: JoinerBoardData,
    ) -> Result<()> {
        
        require!(self.joinable, ZKBattleshipError::GameNotJoinable);
        require!(
            self.board_verifier(
                joiner_data.proof_a,
                joiner_data.proof_b,
                joiner_data.proof_c,
                joiner_data.board_hash
            ), 
            ZKBattleshipError::BoardZKVerificationFailed
        );
        
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

    pub fn is_player(&self, signer: Pubkey) -> bool {
        self.players.contains(&signer)
    }

    pub fn play_opening_shot(
        &mut self, 
        shot: OpeningShotData
    ) -> Result<()> {

        require_eq!(self.turns, 0, ZKBattleshipError::GameAlreadyStarted);
        require!(self.is_ready_to_start(), ZKBattleshipError::GameAlreadyStarted);
        
        self.shots = shot.shot;
        self.turns = 1;
        self.state = GameState::Ongoing;

        Ok(())
    }
    
    pub fn play(&mut self, player_data: PlayerTurnData) -> Result<()> {
        
        require!(self.turns != 0, ZKBattleshipError::FirstTurnShouldBePlayed);
        require!(self.is_ongoing(), ZKBattleshipError::GameAlreadyOver);
        
        if player_data.winner == false {

            require!(
                self.shot_verifier(
                    player_data.proof_a,
                    player_data.proof_b,
                    player_data.proof_c,
                    
                ), 
                ZKBattleshipError::ShotZKVerificationFailed
            );
            self.shots = player_data.player_shot_encrypted;
            self.hits = player_data.enemy_hit_encrypted;
            self.turns += 1;

        } else {
            self.state = GameState::Won {
                winner: self.players[((self.turns + 1) % 2) as usize],
            };  
        }

        Ok(())
    }

}


#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum GameState {
    ReadyToStart,
    Ongoing,
    Won { winner: Pubkey },
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct HostBoardData {
    board_hash: [u8;32],
    host_encryption_pubkey: [[u8;32];2],
    proof_a: [u8; 64],
    proof_b: [u8; 128],
    proof_c: [u8; 64],  
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct JoinerBoardData {
    board_hash: [u8;32],
    joiner_encryption_pubkey: [[u8;32];2],
    proof_a: [u8; 64],
    proof_b: [u8; 128],
    proof_c: [u8; 64],
}

#[derive(AnchorSerialize, AnchorDeserialize, Copy, Clone, PartialEq, Eq)]
pub struct OpeningShotData {
     shot: [[u8;32];5],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct PlayerTurnData {
    player_shot_encrypted: [[u8;32]; 5],
    enemy_hit_encrypted: [[u8;32]; 5],
    winner: bool,
    proof_a: [u8; 64],
    proof_b: [u8; 128],
    proof_c: [u8; 64],    
}
