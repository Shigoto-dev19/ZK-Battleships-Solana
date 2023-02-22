import { GameSimulation } from '../src/gameSimulation';
import { BattleShipClient } from '../src/battleShipClient';
const { expect } = require("chai");
import {   
    boards,
    shots,
    printLog
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
        let bob_turn = await joiner.turnData(
            1,                                 // gameID 
            1,                                 // _hit                         
            shots.player2[player1_nonce - 1],  // next shot from bob to alice
            shots.player1[player1_nonce - 1]   // alice shot to verify
        ); 
        // prove alice's registered shot hit, and register bob's next shot
        await game.turn(bob_turn);
    
        
        /// ALICE PROVES BOB PREV REGISTERED SHOT MISSED ///
        printLog(`Alice reporting result of Bob shot #${player1_nonce - 1} (Turn ${player1_nonce * 2})`)
        // bob's shot hit/miss integrity proof public / private inputs
        let alice_turn = await host.turnData(
            1,                                  // gameID
            0,                                  // _hit
            shots.player1[player1_nonce],       // next shot from alice to bob
            shots.player2[player1_nonce - 1]    // bob shot to verify
        );
        
        // prove bob's registered shot missed, and register alice's next shot
        await game.turn(alice_turn);
    }

    let alice, bob;  // players
    let game;        // GameSimulation instance
    let host;        // BattleshipClient instance for the host
    let joiner;      // BattleshipClient instance for the joiner
     
    before(async () => {
        
        // set players
        alice = "Alice_Address";
        bob = "Bob_Address";
        
        // initialize and store game instance
        ( game = await GameSimulation.initialize() );
        ( host = await BattleShipClient.initialize(alice, boards.player1));
        ( joiner = await BattleShipClient.initialize(bob, boards.player2));
        
    });
    
    it("Start a new game", async () => {
        
        // Player1: Alice hosts a new game
        const host_data = await host.newGameData();
        await game.newGame(host_data);  
        
        expect(game.gameData.players[0]).to.equals(alice);
        expect(game.gameData.players[1]).to.equals('');
        expect(game.gameData.joinable).to.equals(true);
        expect(game.gameData.boards[0]).to.equals(host.boardHash);
        
    })

    it("Join an existing game", async () => {

        // Player2: Bob joins the game
        const joiner_data = await joiner.joinGameData(1);
        await game.joinGame(joiner_data);
        
        expect(game.gameData.players[0]).to.equals(alice); 
        expect(game.gameData.players[1]).to.equals(bob);
        expect(game.gameData.joinable).to.equals(false);
        expect(game.gameData.boards[0]).to.equals(host.boardHash);
        expect(game.gameData.boards[1]).to.equals(joiner.boardHash); 
    })

    it("opening shot", async () => {
        
        // Player1: Alice plays the opening shot
        await game.firstTurn(1, [1, 0]);
        expect(game.gameData.players[0]).to.equals(alice); 
        expect(game.gameData.players[1]).to.equals(bob);
        expect(game.gameData.joinable).to.equals(false);
        expect(game.gameData.boards[0]).to.equals(host.boardHash);
        expect(game.gameData.boards[1]).to.equals(joiner.boardHash); 
        expect(game.gameData.turns).to.equals(1);
        expect(game.gameData.shots[0]).to.deep.equal([1, 0]);
    })
    
    it('Prove hit/ miss for 32 turns', async () => {
        for (let i = 1; i <= 16; i++) {
            await simulateTurn(i)
        }
        
    })

    it('Alice wins on sinking all of Bob\'s ships', async () => {
        
        joiner.printGameData(game.gameData);
        // bob's shot hit/miss integrity proof public / private inputs
        let bob_turn = await joiner.turnData(
            1,                                 // gameID 
            1,                                 // _hit                         
            [0, 0],                            // next shot from bob to alice
            shots.player1[16]                  // alice shot to verify
        ); 
        
        // prove alice's registered shot hit, and register bob's next shot
        await game.turn(bob_turn);
        
        expect(game.gameData.joinable).to.equals(false);
        expect(game.gameData.boards[0]).to.equals(host.boardHash);
        expect(game.gameData.boards[1]).to.equals(joiner.boardHash); 
        expect(game.gameData.turns).to.equals(33);
        expect(game.gameData.winner).to.deep.equal(alice);        

    })

    it('finialize game', () => {
        host.printGameData(game.gameData);
        game.finalizeGame(1);
        expect(game.gameData).to.be.null;
    })
})