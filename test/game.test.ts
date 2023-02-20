const { expect } = require("chai");
import {  
    wasm_path, 
    zkey_path, 
    boards,
    shots,
    printLog,
    initialize,
    getProof
} from '../src/utils';

describe("Play game to completion", async () => {
    
    /**
     * Simulate one guaranteed hit and one guaranteed miss played in the game
     * 
     * @param player1_nonce number - number of shots alice has already taken
     *  - range should be 1 through 16 for structured test
     */
    async function simulateTurn(player1_nonce) {

        printLog(`Bob reporting result of Alice shot #${player1_nonce - 1} (Turn ${player1_nonce * 2 - 1})`)
        /// BOB PROVES ALICE PREVIOUS REGISTERED SHOT HIT ///
        // bob's shot hit/miss integrity proof public / private inputs
        let input_player2 = {
            ships: boards.player2,
            hash: F.toObject(boardHashes.player2),
            shot: shots.player1[player1_nonce - 1],
            hit: 1,
        }
        // compute witness and run through groth16 circuit for proof / signals
        let shot_proof2 = await getProof(
            input_player2,
            wasm_path.shot,
            zkey_path.shot
        )
        
        // prove alice's registered shot hit, and register bob's next shot
        await game.turn(1, 1, shots.player2[player1_nonce - 1], shot_proof2);
    
        
        /// ALICE PROVES BOB PREV REGISTERED SHOT MISSED ///
        printLog(`Alice reporting result of Bob shot #${player1_nonce - 1} (Turn ${player1_nonce * 2})`)
        // bob's shot hit/miss integrity proof public / private inputs
        let input_player1 = {
            ships: boards.player1,
            hash: F.toObject(boardHashes.player1),
            shot: shots.player2[player1_nonce - 1],
            hit: 0
        };
        // compute witness and run through groth16 circuit for proof / signals
        let shot_proof1 = await getProof(
            input_player1,
            wasm_path.shot,
            zkey_path.shot
        )
        
        // prove bob's registered shot missed, and register alice's next shot
        await game.turn(1, 0, shots.player1[player1_nonce], shot_proof1);
    }

    let alice, bob;  // players
    let game;        // GameSimulation instance
    let F;           // ffjavascript BN254 construct
    let boardHashes; // store hashed board for alice and bob
    let board_proof1: Array<string>;
    let board_proof2: Array<string>;

    before(async () => {
        // set players
        alice = "Alice_Address";
        bob = "Bob_Address";
        // initialize and store 
        ({ game, F, boardHashes } = await initialize())
      
        // Player1 Board
        const input_board1 = {
            ships: boards.player1,
            hash: F.toObject(boardHashes.player1)
        }
        // Player2 Board
        const input_board2 = {
            ships: boards.player2,
            hash: F.toObject(boardHashes.player2)
        }

        // Compute Board Proof for player1
        board_proof1 = await getProof(
            input_board1, 
            wasm_path.board, 
            zkey_path.board
        );
        
        // Compute Board Proof for player2
        board_proof2 = await getProof(
            input_board2, 
            wasm_path.board, 
            zkey_path.board
        );

        // Player2 verifies the shot of player on his board
        // He also chooses to block to choose
        const input_shot = {
                ships: boards.player2,
                hash: F.toObject(boardHashes.player2),
                shot: shots.player1[0],
                hit: 1,
            }

        //  Verify the opponents shot
        const shot_proof = await getProof(
            input_shot, 
            wasm_path.shot, 
            zkey_path.shot
        );
    });
    
    it("Start a new game", async () => {
        
        // Player1: Alice hosts a new game
        await game.newGame(boardHashes.player1, alice, board_proof1);  
        
        expect(game.gameData.players[0]).to.equals(alice);
        expect(game.gameData.players[1]).to.equals('');
        expect(game.gameData.joinable).to.equals(true);
        expect(game.gameData.boards[0]).to.equals(boardHashes.player1);
        
    })

    it("Join an existing game", async () => {

        
        // Player2: Bob joins the game
        await game.joinGame(1, boardHashes.player2, bob, board_proof2);
        
        expect(game.gameData.players[0]).to.equals(alice); 
        expect(game.gameData.players[1]).to.equals(bob);
        expect(game.gameData.joinable).to.equals(false);
        expect(game.gameData.boards[0]).to.equals(boardHashes.player1);
        expect(game.gameData.boards[1]).to.equals(boardHashes.player2); 
    })

    it("opening shot", async () => {
        
        // Player1: Alice plays the opening shot
        await game.firstTurn(1, [1, 0]);
        expect(game.gameData.players[0]).to.equals(alice); 
        expect(game.gameData.players[1]).to.equals(bob);
        expect(game.gameData.joinable).to.equals(false);
        expect(game.gameData.boards[0]).to.equals(boardHashes.player1);
        expect(game.gameData.boards[1]).to.equals(boardHashes.player2); 
        expect(game.gameData.turns).to.equals(1);
        expect(game.gameData.shots[0]).to.deep.equal([1, 0]);
    })
    
    it('Prove hit/ miss for 32 turns', async () => {
        for (let i = 1; i <= 16; i++) {
            await simulateTurn(i)
        }
    })

    it('Alice wins on sinking all of Bob\'s ships', async () => {
        // bob's shot hit/miss integrity proof public / private inputs
        const input_player2 = {
            ships: boards.player2,
            hash: F.toObject(boardHashes.player2),
            shot: shots.player1[16],
            hit: 1
        }
        // compute witness and run through groth16 circuit for proof / signals
        let shot_proof2 = await getProof(
            input_player2,
            wasm_path.shot,
            zkey_path.shot
        )
        
        // prove alice's registered shot hit, and register bob's next shot
        await game.turn(1, 1, [0, 0], shot_proof2);
        
        expect(game.gameData.joinable).to.equals(false);
        expect(game.gameData.boards[0]).to.equals(boardHashes.player1);
        expect(game.gameData.boards[1]).to.equals(boardHashes.player2); 
        expect(game.gameData.turns).to.equals(33);
        expect(game.gameData.winner).to.deep.equal(alice);
    })
})