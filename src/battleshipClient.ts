const snarkjs = require('snarkjs');
const { buildPoseidonOpt } = require("circomlibjs");

import { genKeypair, genEcdhSharedKey } from 'maci-crypto';
import {
    parse_poseidon_pk,
    poseidon_encrypt,
    bytes_to_bigint,
    poseidon_decrypt,
    parseProofToBytesArray,
    parseToBytesArray,
    prepare_shotProof_input,
} from '../src/utils'
import {
    parse_gameBoard,
    nestifyArray,
    stringifyBoard,
    printBoard
} from '../game-cli/cli'


//stores the data of a player and generates proofs
class BattleShipClient {

    public player_address: string;
    
    private keypair: any;
    public sharedKey: Array<BigInt>;

    private board: Array<Array<string>>;
    public boardHash;
    public parsed_boardHash: number[];
    public player_boardDisplay: string[][];
    public enemy_boardDisplay: string[][];

    public wasm_board_path: string;
    public zkey_board_path: string;

    public wasm_shot_path: string;
    public zkey_shot_path: string;
    
    public winner: boolean;
    private enemy_hit_count: number;
    private player_shots: number[][];
    private enemy_shots: number[][];
    public player_hits: number[];
    public player_hit_count: number;

    static poseidon: any;
    static F: any;
    
    
    constructor(
        player_address: string,
        board: string[][],
        
    ) {
        this.player_address = player_address;
        this.board = board;
        this.keypair = genKeypair();

        this.player_boardDisplay = parse_gameBoard(this.board);
        this.enemy_boardDisplay = nestifyArray(new Array(100).fill(' '));

        this.winner = false;
        this.enemy_hit_count = 0;
        this.enemy_shots = [];
        this.player_hit_count = 0;
        this.player_shots = [];
        this.player_hits = [];

        this.wasm_board_path = 'circuits/artifacts/setup/board_js/board.wasm';
        this.wasm_shot_path = 'circuits/artifacts/setup/shot_js/shot.wasm';

        this.zkey_board_path = 'circuits/artifacts/setup/zkey/board_final.zkey';
        this.zkey_shot_path = 'circuits/artifacts/setup/zkey/shot_final.zkey';
    }

    static async initialize(player_address: string, board: string[][]) {
        
        // instantiate poseidon hash on bn254 curve + store ffjavascript obj reference
        BattleShipClient.poseidon = await buildPoseidonOpt();
        BattleShipClient.F = BattleShipClient.poseidon.F;

        const client = new BattleShipClient(
            player_address,
            board
        );
        
        return client
    }

    async hash_board(board: Array<Array<string>>) {
        
        // poseidon hash of the board
        const boardHash = await BattleShipClient.poseidon(board.flat());
        
        return boardHash  
    }
    
    async newGameData() {
        
        // compute the board hash
        this.boardHash = await this.hash_board(this.board);
        // parse board Hash
        let hash = BattleShipClient.F.toObject(this.boardHash).toString();
        this.parsed_boardHash = parseToBytesArray([hash.toString()])[0];

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
        
        const parsed_proof =  parseProofToBytesArray(JSON.stringify(proof));

        return { 
            boardHash: this.parsed_boardHash,
            hostEncryptionPubkey: parse_poseidon_pk(this.keypair.pubKey),
            proofA: parsed_proof.proofA,
            proofB: parsed_proof.proofB,
            proofC: parsed_proof.proofC, 
        }
    }

    async joinGameData() {
        
        // compute the board hash
        this.boardHash = await this.hash_board(this.board);
        // parse board Hash
        let hash = BattleShipClient.F.toObject(this.boardHash).toString();
        this.parsed_boardHash = parseToBytesArray([hash.toString()])[0];

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

        const parsed_proof =  parseProofToBytesArray(JSON.stringify(proof));

        return { 
            boardHash: this.parsed_boardHash,
            joinerEncryptionPubkey: parse_poseidon_pk(this.keypair.pubKey),
            proofA: parsed_proof.proofA,
            proofB: parsed_proof.proofB,
            proofC: parsed_proof.proofC, 
        }  
    }

    async openingShot(first_shot: Array<number>) {
        this.player_shots.push(first_shot);
        this.enemy_boardDisplay[first_shot[1]][first_shot[0]] = '\x1b[34mT\x1b[0m\x1b[0m';
        const openingShot_encrypted = poseidon_encrypt(first_shot, this.sharedKey);

        return { shot: openingShot_encrypted }
    }

    async genSharedKey(gameState: any) {

        // generate the shared from the enemy's public key
        let sharedKeyHash;
        let pubKeys = gameState.encryptionPk;
        let pubKeys_bigint: BigInt[][] = pubKeys.map((arr) => arr.map((x) => bytes_to_bigint(x)));
        let enemy_encryption_pk: BigInt[] | undefined;

        enemy_encryption_pk= pubKeys_bigint.find(pk => {
            return !pk.every((element, index) => element === this.keypair.pubKey[index]);
        });
        
        if (enemy_encryption_pk.length === 2) {
            if (enemy_encryption_pk !== this.keypair.pubKey) {
                this.sharedKey = genEcdhSharedKey(
                    this.keypair.privKey,
                    enemy_encryption_pk
                )
            }        

            sharedKeyHash = await BattleShipClient.poseidon(
                this.sharedKey.map((x) => x.toString())
            )
            sharedKeyHash = BattleShipClient.F.toObject(sharedKeyHash).toString()
        }
    }

    async turnData(player_shot: number[], enemy_shot: number[][], player_encrypted_hit: number[][] ) {
        
        // store the player's choice locally
        this.player_shots.push(player_shot);
        this.enemy_boardDisplay[player_shot[1]][player_shot[0]] = '\x1b[34mT\x1b[0m\x1b[0m';

        // retrieve the encrypted enemy shot on-chain and store it plaintext
        let {input_shot, decrypted_shot} = prepare_shotProof_input(
            BattleShipClient.F,
            this.board,
            this.boardHash,
            enemy_shot,
            this.sharedKey
        );    
        
        this.enemy_shots.push(decrypted_shot);    
        
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input_shot,
            this.wasm_shot_path,
            this.zkey_shot_path
        )
        // retrieve the encrypted hit resulton-chain and store it plaintext
        const empty_check = player_encrypted_hit.flat().reduce((acc, cur) => cur === 0 ? acc + 1 : acc, 0) === 160;
        if (!empty_check) {
            const decrypted_hit = poseidon_decrypt(player_encrypted_hit, this.sharedKey, 1);
            this.player_hits.push(Number(decrypted_hit[0]));
            if (decrypted_hit[0] === 1) {
                this.player_hit_count++; 
                if (this.player_shots.length >= 2) {
                    let previous_shot = this.player_shots[this.player_shots.length - 2];
                    this.enemy_boardDisplay[previous_shot[1]][previous_shot[0]] = '\x1b[31mH\x1b[0m';
                }    
            }  
            else {
                if (this.player_shots.length >= 2) {
                    let previous_shot = this.player_shots[this.player_shots.length - 2];
                    this.enemy_boardDisplay[previous_shot[1]][previous_shot[0]] = '\x1b[32mM\x1b[0m';   
                }
            }
        }     
        
        // parse shotProof and publicSignals for the solana program
        const parsed_proof =  parseProofToBytesArray(JSON.stringify(proof));
        
        // encrypt player's shot coordinates
        const player_shot_encrypted = poseidon_encrypt(player_shot, this.sharedKey);
        
        // encrypt enemy's hit result from the output of the shot circuit
        const enemy_hit_encrypted =  poseidon_encrypt([input_shot.hit], this.sharedKey);
        
        // count enemy hits and encrypt the result
        if (input_shot.hit === 1) {
            this.enemy_hit_count++; 
            this.player_boardDisplay[decrypted_shot[1]][decrypted_shot[0]] = '\x1b[31mH\x1b[0m';
        } else {
            this.player_boardDisplay[decrypted_shot[1]][decrypted_shot[0]] = '\x1b[32mM\x1b[0m';
        }   

        this.winner = this.enemy_hit_count == 17;    
           
        return {
            
            playerShotEncrypted: player_shot_encrypted,
            enemyHitEncrypted: enemy_hit_encrypted,
            winner: this.winner,
            proofA: parsed_proof.proofA,
            proofB: parsed_proof.proofB,
            proofC: parsed_proof.proofC, 
        } 
    }

    printBoards() {
        let board1 = stringifyBoard(this.player_boardDisplay);
        let board2 = stringifyBoard(this.enemy_boardDisplay);
        printBoard(board1, board2);
    }

    printGameData(gameState: any) {

        function printHit(hit: number, player_address: string, winner_address: string): string {

            let result;
            if (hit == 1) result = "Hit"; 
            else if (hit == 0) result = "Missed";
            else if (player_address == winner_address) result = "Hit" 
            else result = "Pending"

            return result        
        }

        // call data from the game state on-chain
        let players = gameState.players.map((x)=> x.toString());
        let turn_number = gameState.turns;
        
        let boards = gameState.boards;
        
        const host_identifier = BattleShipClient.F.toObject(boards[0]).toString();
        const joiner_identifier = BattleShipClient.F.toObject(boards[1]).toString();
        let winner_address = '';
        if (gameState.state.won) winner_address = gameState.state.won.winner.toString();
        if (this.player_address == winner_address) this.player_hit_count++;
        
        // print board displays of both players
        if (this.player_address == winner_address) {
            let previous_shot = this.player_shots[this.player_shots.length - 1];
            this.enemy_boardDisplay[previous_shot[1]][previous_shot[0]] = '\x1b[31mH\x1b[0m';
        };
            
        let board1 = stringifyBoard(this.player_boardDisplay);
        let board2 = stringifyBoard(this.enemy_boardDisplay);
        printBoard(board1, board2);
        
        // print plaintext data according to player's turn index

        if (this.player_address === players[0]) {
            console.log('\x1b[35m%s\x1b[0m','\nPlayer1 is the host!');
            console.log('\x1b[36m%s\x1b[0m','Turn number: ', turn_number);
            console.log('\x1b[36m%s\x1b[0m','Address: ', players[0]);
            console.log('\x1b[36m%s\x1b[0m','Board Hash: ', host_identifier);
            console.log('\x1b[36m%s\x1b[0m','Sucessful hits: ', this.player_hit_count);
            
            console.log('\x1b[36m%s\x1b[0m','Targeted shots: ');
            console.log(`Opening Shot #1 --> [${this.player_shots[0]}] --> ${printHit(this.player_hits[0], this.player_address, winner_address)}`);
            for(let turn=1; turn< this.player_shots.length; turn++) {
                
                console.log(`  Shot #${turn} --> [${this.player_shots[turn]}] --> ${printHit(this.player_hits[turn], this.player_address, winner_address)}`)
            }
            
            if (this.winner) 
            console.log('\x1b[36m%s\x1b[0m','Winner: ', 'Player2');
            else if (this.player_address = winner_address)  
            console.log('\x1b[36m%s\x1b[0m', 'Winner: ','Player1');
            else 
            console.log('\x1b[36m%s\x1b[0m','No Winner yet!');
        }
        else {

            console.log('\x1b[35m%s\x1b[0m','\nPlayer2 is the joiner!');
            console.log('\x1b[36m%s\x1b[0m','Turn number: ', turn_number);
            console.log('\x1b[36m%s\x1b[0m','Address: ', players[1]);
            console.log('\x1b[36m%s\x1b[0m','Board Hash: ', joiner_identifier);
            console.log('\x1b[36m%s\x1b[0m','Sucessful hits: ', this.player_hit_count);
            
            console.log('\x1b[36m%s\x1b[0m','Targeted shots: ');
            for(let turn=0; turn< this.player_shots.length; turn++) {
                
                console.log(`  Shot #${turn+1} --> [${this.player_shots[turn]}] --> ${printHit(this.player_hits[turn], this.player_address, winner_address)}`)
            }    
            if (this.winner) 
            console.log('\x1b[36m%s\x1b[0m','Winner: ', 'Player1');
            else if (this.player_address = winner_address)  
            console.log('\x1b[36m%s\x1b[0m', 'Winner: ','Player2');
            else 
            console.log('\x1b[36m%s\x1b[0m','No Winner yet!');
        }            
    }  
}

export { BattleShipClient };