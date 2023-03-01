const fs = require('fs');
const snarkjs = require('snarkjs');
const { buildPoseidonOpt } = require("circomlibjs");


interface encryption_object { [key: number]: Array<BigInt> }
interface shot { [key: number]: encryption_object }
interface hit { [key: number]: encryption_object  }

interface host_BoardData {
    boardHash: Uint8Array;
    host_address: string;
    host_pubkey: Array<BigInt>,
    board_proof: Array<string>;
}
interface joiner_BoardData {
    gameID: number;
    boardHash: Uint8Array;
    joiner_address: string;
    joiner_pubkey: Array<BigInt>,
    board_proof: Array<string>;
}
interface openingShotData {
    gameID: number;
    opening_shot_encrypted: encryption_object;
}

interface player_TurnData {
    gameID: number;
    player_shot_encrypted: encryption_object;
    shot_proof: Array<string>;
    enemy_hit_encrypted: encryption_object;
    enemy_hit_count_encrypted: encryption_object;
    winner_proof: Array<string>;
    winner_publicSignals: Array<string>;
}

interface public_keys { [key: string]: Array<BigInt> }
interface shared_keys { [key: string]: string }


interface Game {
    // the two players in the game
    players : Array<string>,
    // public keys for poseidon symmetric encryption
    pubKeys :  public_keys,
    // poseidon hash of the players symmetric shared key
    sharedKeys: shared_keys,
    // poseidon hash of board placement for each player
    boards : Array<Uint8Array>,
    // false if already two players are in a game else true
    joinable: boolean;
    // turn #
    turns : number,
    // map turn number to shot coordinates: poseidon encrypted
    shots: shot,
    // map turn number to hit/ miss
    hits: hit,
    // track # of hits player has made
    hitNonce: Array<encryption_object>,
    // game winner
    winner: string
}
interface games { [key: number] : Game }

class GameSimulation {
    
    static F: any;
    public vkey_board_path: string;
    public vkey_shot_path: string;
    public vkey_winner_path: string;
    public verificationKeys: any;
    static games: games = {};
    public gameIndex = 0;
    public gameData: Game = {
        players: ["", ""],
        pubKeys: {},
        sharedKeys: {},
        boards: [],
        joinable: true, 
        turns: 0,
        shots: {},
        hits: {},
        hitNonce: [],
        winner: ""
    };

    constructor() {
        
        this.vkey_board_path = 'circuits/artifacts/board_verification_key.json';
        this.vkey_shot_path = 'circuits/artifacts/shot_verification_key.json';
        this.vkey_winner_path = 'circuits/artifacts/winner_verification_key.json';
        // verification key json files
        this.verificationKeys = {
            board: JSON.parse(fs.readFileSync(this.vkey_board_path)),
            shot: JSON.parse(fs.readFileSync(this.vkey_shot_path)),
            winner: JSON.parse(fs.readFileSync(this.vkey_winner_path))
        }
    }
    /**
     * Initialize new environment for interacting with ZK-Battleship game contracts
     * 
     * @returns {Object} :
     *  - game: ZK-Battleship game simulation object
     *  - poseidon: initialized Poseidon ZK-Friendly hash function object from circomlibjs
     *  - boardHashes: hashed versions of alice/ bob boards
     *  - F: initialized ffjavascript BN254 curve object derived from poseidon
     */
    static async initialize() {
        
        // instantiate poseidon  on bn254 curve + store ffjavascript obj reference
        const poseidon = await buildPoseidonOpt();
        GameSimulation.F = poseidon.F;

        // instantiate a gameSimulation
        const game = new GameSimulation();
        
        return game
    }

    async verifyBoardProof(boardHash: Uint8Array, board_proof: Array<string>) {
    
        const publicSignals = [GameSimulation.F.toObject(boardHash).toString()]

        // verify proof locally
        const result_board = await snarkjs.groth16.verify(
            this.verificationKeys.board,
            publicSignals,
            board_proof
        );

        return result_board
    }

    async verifyShotProof(
        boardHash: Uint8Array, 
        encrypted_shot: Array<BigInt>, 
        encryption_nonce: BigInt, 
        shot_proof: Array<string>
    ) {

        const parsed_hash = GameSimulation.F.toObject(boardHash).toString();
        const encrypted_shot_0 = encrypted_shot[0].toString();  
        const encrypted_shot_1 = encrypted_shot[1].toString();
        const encrypted_shot_2 = encrypted_shot[2].toString();  
        const encrypted_shot_3 = encrypted_shot[3].toString();
        
        const publicSignals = [

            parsed_hash, 
            encrypted_shot_0, 
            encrypted_shot_1,
            encrypted_shot_2,
            encrypted_shot_3,
            encryption_nonce.toString()     
        ];

        // verify proof locally
        const result_shot = await snarkjs.groth16.verify(
            this.verificationKeys.shot, 
            publicSignals, 
            shot_proof
        )

        return result_shot
    }

    async verifyWinnerProof(winner_proof: Array<string>, winner_publicSignals: Array<string>) {
        
        const result_winner = await snarkjs.groth16.verify(
            this.verificationKeys.winner, 
            winner_publicSignals, 
            winner_proof
        )

        return result_winner
    }

    async newGame(data: host_BoardData ) {

        const board_verification = await this.verifyBoardProof(data.boardHash, data.board_proof);
        if (board_verification) {
            this.gameIndex++;
            console.log('      game index: ',this.gameIndex);
            GameSimulation.games[this.gameIndex] = this.gameData;
            GameSimulation.games[this.gameIndex].players[0] = data.host_address;
            GameSimulation.games[this.gameIndex].pubKeys[data.host_address] = data.host_pubkey;
            GameSimulation.games[this.gameIndex].boards[0] = data.boardHash; 
            GameSimulation.games[this.gameIndex].joinable = true;
        }
        else throw new Error('Board ZK verification failed!');
        
    }

    async joinGame(data: joiner_BoardData) {
        
        if (GameSimulation.games[data.gameID].joinable == true) {
        
            await this.verifyBoardProof(data.boardHash, data.board_proof);

            GameSimulation.games[data.gameID].players[1] = data.joiner_address;
            GameSimulation.games[data.gameID].pubKeys[data.joiner_address] = data.joiner_pubkey;
            GameSimulation.games[data.gameID].boards[1] = data.boardHash; 
            GameSimulation.games[data.gameID].joinable = false;

        } else throw new Error('An Error occured: The game is not joinable!')
        
    }

    async playerTurn(gameID: number) {

        const noWinner = GameSimulation.games[gameID].winner === "";
        const turn = GameSimulation.games[gameID].turns % 2;
        
        // return the player's index according the turn count
        if (noWinner) {
            return turn
        } else {
            throw new Error('The game has already finished!')
        }
    }

    async firstTurn(data: openingShotData ) {

        const game = GameSimulation.games[data.gameID];
        
        if (game.turns == 0) {
            
            game.shots[game.turns] = data.opening_shot_encrypted;
            game.turns++;
            
        } else {
            throw new Error('Not first turn!')
        }
    }

    async turn(data: player_TurnData) {

        const game = GameSimulation.games[data.gameID];
        const turn = await this.playerTurn(data.gameID);
        const boardHash = game.boards[turn];
        
        const enemy_shot_nonce = game.shots[game.turns - 1][0];
        const enemy_shot = game.shots[game.turns - 1][1];

        if (game.turns != 0) {
            
            // check proof
            const shot_verification = this.verifyShotProof(
                boardHash, 
                enemy_shot, 
                enemy_shot_nonce[0], 
                data.shot_proof
            );
            
            // update game state
            if (shot_verification) {

                game.hits[game.turns - 1] = data.enemy_hit_encrypted;
                game.hitNonce[(game.turns - 1) % 2] = data.enemy_hit_count_encrypted;

                if (data.winner_publicSignals[0] == '1') {
                    this.gameOver(
                        data.gameID,
                        data.winner_proof,
                        data.winner_publicSignals
                    );
                }    
                // check if game over
                else if (game.winner === '') {
                    // add next shot
                    game.shots[game.turns] = data.player_shot_encrypted;
                    game.turns++;   
                }
                else throw new Error('The game has already finished!')
            } else throw new Error('shot ZK verification failed!')
        } else throw new Error('First turn should be played!')
                 
    }

    async gameState(gameID: number) {

        // to be updated
        const game = GameSimulation.games[gameID];
        
        let players = game.players;
        let boards = game.boards;
        let turn_number = game.turns;
        let hit_history = game.hitNonce;
        let winner = game.winner;  
        
        console.log('Turn number: ', turn_number);
        if (winner == '') console.log('No Winner yet!');
        else console.log('Winner: ', winner);

        console.log('\nPlayer1: \n');
        console.log('Address: ', players[0]);
        console.log('Board: ', GameSimulation.F.toObject(boards[0]).toString());
        console.log('Hit Number: ',hit_history[0]);

        console.log('\nPlayer2: \n');
        console.log('Address: ', players[1]);
        console.log('Board: ', GameSimulation.F.toObject(boards[1]).toString());
        console.log('Hit Number: ',hit_history[1])

        
    }
        
    async gameOver(gameID: number, winner_proof: Array<string>, winner_publicSignals: Array<string>) {

        const winner_verification = await this.verifyWinnerProof(winner_proof, winner_publicSignals);
        const game = GameSimulation.games[gameID];
        
        if (winner_verification == true) {

            if(winner_publicSignals[0] == '1') {
                
                game.winner = game.turns % 2 == 0
                ? game.players[0]
                : game.players[1];   
            }
        }
        else throw new Error('Winner Verification failed!')

    }

    finalizeGame(gameID: number) {
        // deletes the match data
        GameSimulation.games[gameID] = null;
        this.gameData = null;
    }
}

export{ GameSimulation };

  