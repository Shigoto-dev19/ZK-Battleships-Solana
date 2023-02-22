import { 
    snarkjs, 
    buildMimcSponge,
} from './utils';

type Board = Array<Array<string>>;
type Binary = 0 | 1;

interface shot { [key: number]: Array<number> }
interface hit { [key: number]: Binary }
interface Game {
    players : Array<string>;
    boards : Array<Uint8Array>;
    joinable: boolean;
    turns : number;
    shots: shot;
    hits: hit;
    hitNonce: Array<number>;
    winner: string;
}

//stores the data of a player and generates proofs
class BattleShipClient {

    public player_address: string;
    private board: Board;
    public wasm_board_path: string;
    public wasm_shot_path: string;
    public zkey_board_path: string;
    public zkey_shot_path: string;
    static F: any;
    public boardHash;
    
    constructor(
        player_address: string,
        board: Board,
        wasm_board_path: string, 
        wasm_shot_path: string, 
        zkey_board_path: string,
        zkey_shot_path: string 
    ) {
        this.player_address = player_address;
        this.board = board;
        this.wasm_board_path = wasm_board_path;
        this.wasm_shot_path = wasm_shot_path;
        this.zkey_board_path = zkey_board_path;
        this.zkey_shot_path = zkey_shot_path;
    }
    static async initialize(player_address: string, board: Board) {
        
        const wasm_path = {
            board: 'circuits/artifacts/setup/board_js/board.wasm',
            shot: 'circuits/artifacts/setup/shot_js/shot.wasm'
        }
        
        const zkey_path = {
            board: 'circuits/artifacts/setup/zkey/board_final.zkey',
            shot: 'circuits/artifacts/setup/zkey/shot_final.zkey'
        }
        // instantiate a BattleShipClient class
        const client = new BattleShipClient(
            player_address,
            board, 
            wasm_path.board, 
            wasm_path.shot, 
            zkey_path.board,
            zkey_path.shot
        );
        
        return client
    }

    async hash_board(board: Board) {
        
        // instantiate mimc sponge on bn254 curve 
        const mimcSponge = await buildMimcSponge();
        // store board hashes for quick use
        const boardHash = await mimcSponge.multiHash(board.flat());
        
        return boardHash  
    }
    
    async newGameData() {
        
        // instantiate mimc sponge on bn254 curve + store ffjavascript obj reference
        const mimcSponge = await buildMimcSponge();
        BattleShipClient.F = mimcSponge.F;
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
            board_proof: proof
        }
        
    }

    async turnData(gameID: number, _hit: Binary, player_shot: Array<number>, enemy_shot: Array<number>) {
        
        // bob's shot hit/miss integrity proof public / private inputs
        let input_shot = {
            ships: this.board,
            hash: BattleShipClient.F.toObject(this.boardHash),
            shot: enemy_shot,
            hit: _hit,
        }
        // compute witness and run through groth16 circuit for proof / signals
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input_shot,
            this.wasm_shot_path,
            this.zkey_shot_path
        )
        
        return {
            gameID: gameID,
            _hit: _hit,
            _shot: player_shot,
            shot_proof: proof
        }
    }

    printGameData(game: Game) {

        let players = game.players;
        let turn_number = game.turns;
        let hit_history = game.hitNonce;
        let hits = game.hits;
        let winner = game.winner; 
        let boards = game.boards;
        let shots = game.shots;
        const hash_identifier = BattleShipClient.F.toObject(this.boardHash).toString();
        const host_identifier = BattleShipClient.F.toObject(boards[0]).toString();
        const joiner_identifier = BattleShipClient.F.toObject(boards[1]).toString();
        
        let player_shots: shot = {};

        if (hash_identifier === host_identifier) {
            console.log('\x1b[35m%s\x1b[0m','\nPlayer1 is the host!');
            console.log('\x1b[36m%s\x1b[0m','Turn number: ', turn_number);
            console.log('\x1b[36m%s\x1b[0m','Address: ', players[0]);
            console.log('\x1b[36m%s\x1b[0m','Board Hash: ', host_identifier);
            console.log('\x1b[36m%s\x1b[0m','Sucessful hits: ',hit_history[0]);
            for (let turn in shots) {
                const index = Number(turn);
                if (index % 2 === 0) {
                  player_shots[index] = shots[index];
                }
              }
            console.log('\x1b[36m%s\x1b[0m','Targeted shots: ');
            for(let key in player_shots) console.log(`  Turn ${key} --> [${player_shots[key]}] --> ${hits[key] == 1 ? "Hit" : "Missed"}`);

            if (winner == '') console.log('\x1b[36m%s\x1b[0m','No Winner yet!');
            else console.log('\x1b[36m%s\x1b[0m','Winner: ', winner);
        }
        else {
            console.log('\x1b[35m%s\x1b[0m','\nPlayer2 is the joiner!');
            console.log('\x1b[36m%s\x1b[0m','Turn number: ', turn_number);
            console.log('\x1b[36m%s\x1b[0m','Address: ', players[1]);
            console.log('\x1b[36m%s\x1b[0m','Board Hash: ', joiner_identifier);
            console.log('\x1b[36m%s\x1b[0m','Sucessful hits: ',hit_history[1]);
            
            for (let turn in shots) {
                const index = Number(turn);
                if (index % 2 === 1) {
                  player_shots[index] = shots[index];
                }
              }
            console.log('\x1b[36m%s\x1b[0m','Targeted shots: ');
            for(let key in player_shots) console.log(`  Turn ${key} --> [${player_shots[key]}] --> ${hits[key] == 1 ? "Hit" : "Missed"}`);

            if (winner == '') console.log('\x1b[36m%s\x1b[0m','No Winner yet!');
            else console.log('\x1b[36m%s\x1b[0m','Winner: ', winner);
        }  
    }
    
}

export { BattleShipClient };