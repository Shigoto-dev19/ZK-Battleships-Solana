import { 
    verificationKeys, 
    snarkjs,
    buildMimcSponge,
    initialize
} from './utils';

type Board = Array<Array<string>>;
type Binary = 0 | 1;
interface shot { [key: number]: Array<number> }
interface hit { [key: number]: Binary }

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

    async hash_board(board: Board) {
        // this method is to be deleted

        // instantiate mimc sponge on bn254 curve 
        const mimcSponge = await buildMimcSponge();
        
        // store board hashes for quick use
        const boardHash = await mimcSponge.multiHash(board.flat());
        
        return boardHash  
    }

    async verifyBoardProof(boardHash: Uint8Array, proof: Array<string>) {
    
        // ffjavascript obj reference
        const {F} = await initialize();
        
        const publicSignals = [F.toObject(boardHash).toString()]

        // verify proof locally
        const result_board = await snarkjs.groth16.verify(
            verificationKeys.board,
            publicSignals,
            proof
        );

        return result_board
    }

    async verifyShotProof(boardHash: Uint8Array, shot: Array<number>, hit: Binary, proof: Array<string>) {

        const {F} = await initialize();
        const parsed_hash = F.toObject(boardHash).toString();
        const shot_x = shot[0].toString();  
        const shot_y = shot[1].toString();
        
        const publicSignals = [parsed_hash, shot_x, shot_y, hit.toString()];

        // verify proof locally
        const result_shot = await snarkjs.groth16.verify(
            verificationKeys.shot, 
            publicSignals, 
            proof
        )

        return result_shot
    }

    async newGame(boardHash: Uint8Array, host_address: string, board_proof: Array<string> ) {

        try {

            await this.verifyBoardProof(boardHash, board_proof);

            this.gameIndex++;
            console.log('      game index: ',this.gameIndex);
            GameSimulation.games[this.gameIndex] = this.gameData;
            GameSimulation.games[this.gameIndex].players[0] = host_address;
            GameSimulation.games[this.gameIndex].boards[0] = boardHash; 
            GameSimulation.games[this.gameIndex].joinable = true;

            //console.log(`${host_address} is hosting a new game!`);

        } catch(error) {
            console.log("Invalid Board Config!", error)
        }

    }

    async joinGame(gameID: number, boardHash: Uint8Array, player_address: string, board_proof: Array<string>) {
        
        if (GameSimulation.games[gameID].joinable == true) {
        
            try {
                
                await this.verifyBoardProof(boardHash, board_proof);

                GameSimulation.games[gameID].players[1] = player_address;
                GameSimulation.games[gameID].boards[1] = boardHash;
                //inGame[player_address] = gameID; 
                GameSimulation.games[gameID].joinable = false;

                //console.log(`${player_address} has joined a game!`);

            } catch(error) {
                console.log("Invalid Board Config!",error)
            }

        } else throw new Error('An Error occured: The game is not joinable!')
        
    }

    async playerTurn(gameID: number) {

        const noWinner = GameSimulation.games[gameID].winner === "";
        const turn = GameSimulation.games[gameID].turns % 2;
        
        // return the player's index according the turn count
        if (noWinner) {
            return turn
        } else {
            throw new Error('The has already finished!')
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

    async turn(gameID: number, _hit: Binary, _shot: Array<number>, shot_proof: Array<string>) {

        const game = GameSimulation.games[gameID];
        const turn = await this.playerTurn(gameID);
        const boardHash = game.boards[turn];
        const enemy_shot = game.shots[game.turns - 1];

        if (game.turns != 0) {
            // check proof
            try{
                this.verifyShotProof(boardHash, enemy_shot, _hit, shot_proof);
            } catch(error) {
                console.log("Invalid turn proof!", error)
            }
            // update game state
            game.hits[game.turns - 1] = _hit;
            if (_hit) game.hitNonce[(game.turns - 1) % 2]++;
                
            // check if game over
            if (game.hitNonce[(game.turns - 1) % 2] >= this.HIT_MAX) this.gameOver(gameID);
            else {
                // add next shot
                game.shots[game.turns] = _shot;
                game.turns++;
                
            }
        } else {
            throw new Error('First turn should be played!')
        }       
            
    }

    static async gameState(gameID: number) {

        const {F} = await initialize();

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
        console.log('Board: ', F.toObject(boards[0]).toString());
        console.log('Hit Number: ',hit_history[0]);

        console.log('\nPlayer2: \n');
        console.log('Address: ', players[1]);
        console.log('Board: ', F.toObject(boards[1]).toString());
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
}

export{ GameSimulation };

  