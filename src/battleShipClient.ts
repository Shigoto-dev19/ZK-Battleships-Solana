const snarkjs = require('snarkjs');
const { buildPoseidonOpt } = require("circomlibjs");

import { poseidonEncrypt, poseidonDecrypt, genRandomNonce } from '../src/poseidon_encryption/index';
import { genKeypair, genEcdhSharedKey } from 'maci-crypto';

type Board = Array<Array<string>>;

interface shot { [key: number]: encryption_object }
interface hit { [key: number]: encryption_object  }
interface public_keys { [key: string]: Array<BigInt> }
interface shared_keys { [key: string]: string }
interface encryption_object { [index: number]: Array<BigInt> }
interface Game {
    players : Array<string>,
    pubKeys :  public_keys,
    sharedKeys: shared_keys,
    boards : Array<Uint8Array>,
    joinable: boolean;
    turns : number,
    shots: shot,
    hits: hit,
    hitNonce: Array<encryption_object>,
    winner: string
}

//stores the data of a player and generates proofs
class BattleShipClient {

    public player_address: string;
    
    private keypair: any;
    public sharedKey: Array<BigInt>;

    private board: Board;
    public boardHash;
    public wasm_board_path: string;
    public zkey_board_path: string;

    public wasm_shot_path: string;
    public zkey_shot_path: string;
    
    public wasm_winner_path: string;
    public zkey_winner_path: string;

    private enemy_hit_count: number;

    static poseidon: any;
    static F: any;
    
    
    constructor(
        player_address: string,
        board: Board,
        
    ) {
        this.player_address = player_address;
        this.board = board;
        this.keypair = genKeypair();
        this.enemy_hit_count = 0;

        this.wasm_board_path = 'circuits/artifacts/setup/board_js/board.wasm';
        this.wasm_shot_path = 'circuits/artifacts/setup/shot_js/shot.wasm';
        this.wasm_winner_path = 'circuits/artifacts/setup/winner_js/winner.wasm';

        this.zkey_board_path = 'circuits/artifacts/setup/zkey/board_final.zkey';
        this.zkey_shot_path = 'circuits/artifacts/setup/zkey/shot_final.zkey';
        this.zkey_winner_path = 'circuits/artifacts/setup/zkey/winner_final.zkey';
    }

    static async initialize(player_address: string, board: Board) {
        
        // instantiate poseidon hash on bn254 curve 
        BattleShipClient.poseidon = await buildPoseidonOpt();
        const client = new BattleShipClient(
            player_address,
            board
        );
        
        return client
    }

    async hash_board(board: Board) {
        
        // poseidon hash of the board
        const boardHash = await BattleShipClient.poseidon(board.flat());
        
        return boardHash  
    }
    
    async newGameData() {
        
        // instantiate poseidon hash on bn254 curve + store ffjavascript obj reference
        const poseidon = await buildPoseidonOpt();
        BattleShipClient.F = poseidon.F;
        // compute the board hash
        this.boardHash = await this.hash_board(this.board);
        // prepare the input to generate board proof
        const input_board = {
            ships: this.board,
            hash: BattleShipClient.F.toObject(this.boardHash)
        }
        // generate board proof
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input_board, 
            this.wasm_board_path, 
            this.zkey_board_path
        );

        return { 
            boardHash: this.boardHash,
            host_address: this.player_address,
            host_pubkey: this.keypair.pubKey,
            board_proof: proof 
        }

    }

    async joinGameData(gameID: string) {
        
        // compute the board hash
        this.boardHash = await this.hash_board(this.board);
        // prepare the input to generate board proof
        const input_board = {
            ships: this.board,
            hash: BattleShipClient.F.toObject(this.boardHash)
        }
        // generate board proof
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input_board, 
            this.wasm_board_path, 
            this.zkey_board_path
        );

        return { 
            gameID: gameID, 
            boardHash: this.boardHash, 
            joiner_address: this.player_address, 
            joiner_pubkey: this.keypair.pubKey,
            board_proof: proof
        }
        
    }

    async openingShot(gameID: string, first_shot: Array<number>) {
        
        let opening_shot_encrypted: encryption_object = {};

        const encryption_nonce = genRandomNonce();
        const encrypted_shot = poseidonEncrypt(
            first_shot, 
            this.sharedKey, 
            encryption_nonce
        )
        opening_shot_encrypted[0] = [encryption_nonce];
        opening_shot_encrypted[1] = encrypted_shot;
        return { 
            gameID: gameID, 
            opening_shot_encrypted 
        }
    }

    async genSharedKey(game: Game) {

        // generate the shared from the enemy's public key
        let sharedKeyHash;
        const pubKeys = game.pubKeys;
        if (Object.keys(pubKeys).length === 2) {
            for (const key_owner in pubKeys) {
                if (key_owner != this.player_address) {
                    this.sharedKey = genEcdhSharedKey(
                        this.keypair.privKey,
                        pubKeys[key_owner]
                    )
                }        
            }
            sharedKeyHash = await BattleShipClient.poseidon(
                this.sharedKey.map((x) => x.toString())
            )
            sharedKeyHash = BattleShipClient.F.toObject(sharedKeyHash).toString()
        }
        game.sharedKeys[this.player_address] = sharedKeyHash;

    }

    async turnData(gameID: number, player_shot: Array<number>, enemy_shot: Array<BigInt>, enemy_encryption_nonce: BigInt) {
        
        // required function to avoid block-redeclaration errors
        async function fullProve(input, wasm_path, zkey_path) {
            
            let { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasm_path, zkey_path);
            return [proof, publicSignals]
        }
        let player_shot_encrypted: encryption_object = {};

        // encrypt player's shot coordinates
        const shot_encryption_nonce = genRandomNonce();
        const encrypted_player_shot = poseidonEncrypt(
            player_shot.map((x) => BigInt(x)), 
            this.sharedKey, 
            shot_encryption_nonce
        )
        player_shot_encrypted[0] = [shot_encryption_nonce];
        player_shot_encrypted[1] = encrypted_player_shot;

        // enemy's shot hit/miss integrity proof public / private inputs
        let input_shot = {
            ships: this.board,
            hash: BattleShipClient.F.toObject(this.boardHash),
            encrypted_shot: enemy_shot.map((x) => x.toString()),
            nonce: enemy_encryption_nonce.toString(),
            key: this.sharedKey.map((x) => x.toString())
                 
        }
        // compute witness and run through groth16 circuit for proof / signals
        const [ shot_proof, shot_publicSignals ] = await fullProve(
            input_shot,
            this.wasm_shot_path,
            this.zkey_shot_path
        )
        // encrypt hit result and store the nonce as key and ciphertext as value
        let enemy_hit_encrypted: encryption_object = {};
        const hit_encryption_nonce = genRandomNonce();
        const hit_encrypted = poseidonEncrypt(
            [BigInt(shot_publicSignals[0])], 
            this.sharedKey, 
            hit_encryption_nonce
        )
        enemy_hit_encrypted[0] = [hit_encryption_nonce];
        enemy_hit_encrypted[1] = hit_encrypted;
        
        // count enemy hits and encrypt the result
        let enemy_hit_count_encrypted: encryption_object = {};

        if (shot_publicSignals[0] === '1') this.enemy_hit_count++;
        const hit_count_encryption_nonce = genRandomNonce();
        
        const hit_count_encrypted = poseidonEncrypt(
            [BigInt(this.enemy_hit_count)], 
            this.sharedKey, 
            hit_count_encryption_nonce
        )
        enemy_hit_count_encrypted[0] = [hit_count_encryption_nonce];
        enemy_hit_count_encrypted[1] = hit_count_encrypted;
        
        // zk prove if the enemy is the winner: hit count = 17
        let input_winner = {
            encrypted_hit_count: enemy_hit_count_encrypted['1'].map((x) => x.toString()),
            nonce: enemy_hit_count_encrypted['0'].toString(),
            key: this.sharedKey.map((x) => x.toString())
        }
        let [winner_proof, winner_publicSignals] = await fullProve(
            input_winner,
            this.wasm_winner_path,
            this.zkey_winner_path
        )
        
        return {
            gameID: gameID,
            player_shot_encrypted: player_shot_encrypted,
            shot_proof: shot_proof,
            enemy_hit_encrypted: enemy_hit_encrypted,
            enemy_hit_count_encrypted: enemy_hit_count_encrypted,
            winner_proof: winner_proof,
            winner_publicSignals: winner_publicSignals
        }
    }

    printGameData(game: Game) {

        function shot_decrypt(shot: Array<BigInt>, key: Array<BigInt>, nonce: BigInt) {
            
            const result = poseidonDecrypt(
                shot, 
                key, 
                nonce,
                2
            )
            return result
        }
        function hit_decrypt(hit: Array<BigInt>, key: Array<BigInt>, nonce: BigInt) {
            
            const result = poseidonDecrypt(
                hit, 
                key, 
                nonce,
                1
            )
            return result
        }

        // call data from the game state
        let players = game.players;
        let turn_number = game.turns;
        let hitNonce = game.hitNonce;
        let hits = game.hits; 
        let boards = game.boards;
        let shots = game.shots;
        const skey = this.sharedKey;
        const hash_identifier = BattleShipClient.F.toObject(this.boardHash).toString();
        const host_identifier = BattleShipClient.F.toObject(boards[0]).toString();
        const joiner_identifier = BattleShipClient.F.toObject(boards[1]).toString();
        
        let player_shots: shot = {};

        // print cleartext data according to player's turn index
        let indexes = [];
        let hit_history;
        if (hash_identifier === host_identifier) {
            console.log('\x1b[35m%s\x1b[0m','\nPlayer1 is the host!');
            console.log('\x1b[36m%s\x1b[0m','Turn number: ', turn_number);
            console.log('\x1b[36m%s\x1b[0m','Address: ', players[0]);
            console.log('\x1b[36m%s\x1b[0m','Board Hash: ', host_identifier);
            hit_history = hit_decrypt(hitNonce[0][1], skey, hitNonce[0][0][0])
            console.log('\x1b[36m%s\x1b[0m','Sucessful hits: ',Number(hit_history));
            for (let turn in shots) {
                const index = Number(turn);
                if (index % 2 === 0) {
                  player_shots[index] = shots[index];
                  indexes.push(index)
                }
            }
            console.log('\x1b[36m%s\x1b[0m','Targeted shots: ');
            for(let key in player_shots) {
                let shot = shot_decrypt(shots[key][1], skey, shots[key][0][0]);
                let hit = Number(hit_decrypt(hits[key][1], skey,  hits[key][0][0]));
                console.log(`  Turn ${key} --> [${shot}] --> ${ hit == 1 ? "Hit" : "Missed"}`);
            }
            let enemy_hit_history = hit_decrypt(hitNonce[1][1], skey, hitNonce[1][0][0]);
            if (Number(hit_history < 17) && Number(enemy_hit_history) < 17) console.log('\x1b[36m%s\x1b[0m','No Winner yet!');
            else if (Number(hit_history < 17) && Number(enemy_hit_history) === 17) console.log('\x1b[36m%s\x1b[0m', 'Winner: ','Player2');
            else console.log('\x1b[36m%s\x1b[0m','Winner: ', 'Player1');
        }
        else {
            console.log('\x1b[35m%s\x1b[0m','\nPlayer2 is the joiner!');
            console.log('\x1b[36m%s\x1b[0m','Turn number: ', turn_number);
            console.log('\x1b[36m%s\x1b[0m','Address: ', players[1]);
            console.log('\x1b[36m%s\x1b[0m','Board Hash: ', joiner_identifier);
            hit_history = hit_decrypt(hitNonce[1][1], skey, hitNonce[1][0][0]);
            console.log('\x1b[36m%s\x1b[0m','Sucessful hits: ', Number(hit_history));
            
            for (let turn in shots) {
                const index = Number(turn);
                if (index % 2 === 1) {
                  player_shots[index] = shots[index];
                }
              }
            console.log('\x1b[36m%s\x1b[0m','Targeted shots: ');
            
            for(let key in player_shots) {
                let shot = shot_decrypt(shots[key][1],skey,shots[key][0][0])
                let hit = Number(hit_decrypt(hits[key][1],skey,hits[key][0][0]));
                console.log(`  Turn ${key} --> [${shot}] --> ${ hit == 1 ? "Hit" : "Missed"}`);
            }

            let enemy_hit_history = hit_decrypt(hitNonce[0][1], skey, hitNonce[0][0][0]);
            if (Number(hit_history < 17) && Number(enemy_hit_history) < 17) console.log('\x1b[36m%s\x1b[0m','No Winner yet!');
            else if (Number(hit_history < 17) && Number(enemy_hit_history) === 17) console.log('\x1b[36m%s\x1b[0m','Winner: ','Player1');
            else console.log('\x1b[36m%s\x1b[0m','Winner: ', 'Player2');
        }

            
    }  
}

export { BattleShipClient };