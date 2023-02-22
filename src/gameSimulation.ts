import {  
    snarkjs,
    buildMimcSponge,
    fs
} from './utils';

type Binary = 0 | 1;
interface shot { [key: number]: Array<number> }
interface hit { [key: number]: Binary }

interface host_BoardData {
    boardHash: Uint8Array;
    host_address: string;
    board_proof: Array<string>;
}
interface joiner_BoardData {
    gameID: number;
    boardHash: Uint8Array;
    joiner_address: string;
    board_proof: Array<string>;
}
interface player_TurnData {
    gameID: number;
    _hit: Binary; 
    _shot: Array<number>; 
    shot_proof: Array<string>;
}


interface Game {
    // the two players in the game
    players : Array<string>,
    // mimcsponge hash of board placement for each player
    boards : Array<Uint8Array>,
    // false if already two players are in a game else true
    joinable: boolean;
    // turn #
    turns : number,
    // map turn number to shot coordinates
    shots: shot,
    // map turn number to hit/ miss
    hits: hit,
    // track # of hits player has made
    hitNonce: Array<number>,
    // game winner
    winner: string
}
interface games { [key: number] : Game }

class GameSimulation {
    
    private HIT_MAX = 17;
    static F: any;
    public vkey_board_path: string;
    public vkey_shot_path: string;
    public verificationKeys: any;
    static games: games = {};
    public gameIndex = 0;
    public gameData: Game = {
        players: ["", ""],
        boards: [],
        joinable: true, 
        turns: 0,
        shots: {},
        hits: {},
        hitNonce: [0, 0],
        winner: ""
    };

    constructor(vkey_board_path: string, vkey_shot_path: string ) {
        
        this.vkey_board_path = vkey_board_path;
        this.vkey_shot_path = vkey_shot_path;
        // verification key json files
        this.verificationKeys = {
            board: JSON.parse(fs.readFileSync(vkey_board_path)),
            shot: JSON.parse(fs.readFileSync(vkey_shot_path))
        }
    }
    /**
     * Initialize new environment for interacting with ZK-Battleship game contracts
     * 
     * @returns {Object} :
     *  - game: ZK-Battleship game simulation object
     *  - mimcSponge: initialized MiMC Sponge ZK-Friendly hash function object from circomlibjs
     *  - boardHashes: hashed versions of alice/ bob boards
     *  - F: initialized ffjavascript BN254 curve object derived from mimcSponge
     */
    static async initialize() {
        
        // verification keys paths
        const vkey_board_path = 'circuits/artifacts/board_verification_key.json';
        const vkey_shot_path = 'circuits/artifacts/shot_verification_key.json';
        
        // instantiate mimc sponge on bn254 curve + store ffjavascript obj reference
        const mimcSponge = await buildMimcSponge();
        GameSimulation.F = mimcSponge.F;

        // instantiate a gameSimulation
        const game = new GameSimulation(vkey_board_path, vkey_shot_path);
        
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

    async verifyShotProof(boardHash: Uint8Array, shot: Array<number>, hit: Binary, shot_proof: Array<string>) {

        const parsed_hash = GameSimulation.F.toObject(boardHash).toString();
        const shot_x = shot[0].toString();  
        const shot_y = shot[1].toString();
        
        const publicSignals = [
            parsed_hash, 
            shot_x, 
            shot_y, 
            hit.toString()
        ];

        // verify proof locally
        const result_shot = await snarkjs.groth16.verify(
            this.verificationKeys.shot, 
            publicSignals, 
            shot_proof
        )

        return result_shot
    }

    async newGame(data: host_BoardData ) {

        await this.verifyBoardProof(data.boardHash, data.board_proof);

        this.gameIndex++;
        console.log('      game index: ',this.gameIndex);
        GameSimulation.games[this.gameIndex] = this.gameData;
        GameSimulation.games[this.gameIndex].players[0] = data.host_address;
        GameSimulation.games[this.gameIndex].boards[0] = data.boardHash; 
        GameSimulation.games[this.gameIndex].joinable = true;

        //console.log(`${host_address} is hosting a new game!`);
    }

    async joinGame(data: joiner_BoardData) {
        
        if (GameSimulation.games[data.gameID].joinable == true) {
        
            await this.verifyBoardProof(data.boardHash, data.board_proof);

            GameSimulation.games[data.gameID].players[1] = data.joiner_address;
            GameSimulation.games[data.gameID].boards[1] = data.boardHash; 
            GameSimulation.games[data.gameID].joinable = false;

            //console.log(`${player_address} has joined a game!`);

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

    async firstTurn(gameID: number, _shot: Array<number> ) {

        const game = GameSimulation.games[gameID];
        
        if (game.turns == 0) {
            game.shots[game.turns] = _shot;
            game.turns++;
            //console.log('The first turn is played!')
        } else {
            throw new Error('Not first turn!')
        }
    }

    async turn(data: player_TurnData) {

        const game = GameSimulation.games[data.gameID];
        const turn = await this.playerTurn(data.gameID);
        const boardHash = game.boards[turn];
        const enemy_shot = game.shots[game.turns - 1];

        if (game.turns != 0) {
            
            // check proof
            this.verifyShotProof(boardHash, enemy_shot, data._hit, data.shot_proof);
            
            // update game state
            game.hits[game.turns - 1] = data._hit;
            if (data._hit) game.hitNonce[(game.turns - 1) % 2]++;
                
            // check if game over
            if (game.hitNonce[(game.turns - 1) % 2] >= this.HIT_MAX) this.gameOver(data.gameID);
            else {
                // add next shot
                game.shots[game.turns] = data._shot;
                game.turns++;
                
            }
        } else {
            throw new Error('First turn should be played!')
        }       
            
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
        
    async gameOver(gameID: number) {

        const game = GameSimulation.games[gameID];
        if(game.hitNonce[0] == this.HIT_MAX || game.hitNonce[1] == this.HIT_MAX) {
            
            game.winner = game.hitNonce[0] == this.HIT_MAX
            ? game.players[0]
            : game.players[1];
        }

    }

    finalizeGame(gameID: number) {
        // deletes the match data
        GameSimulation.games[gameID] = null;
        this.gameData = null;
    }
}

export{ GameSimulation };

  