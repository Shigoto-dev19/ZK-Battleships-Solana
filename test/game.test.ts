import { GameSimulation } from '../src/gameSimulation';
import { BattleShipClient } from '../src/battleShipClient';
const { expect } = require("chai");

// inline ephemeral logging
function printLog(msg) {
    if (process.stdout.isTTY) {
        process.stdout.clearLine(-1);
        process.stdout.cursorTo(0);
        process.stdout.write(msg);
    }
}

// x, y, z (horizontal/ verical orientation) ship placements
const game1_boards = {
    player1: [
        ["0", "0", "0"],
        ["0", "1", "0"],
        ["0", "2", "0"],
        ["0", "3", "0"],
        ["0", "4", "0"]
    ],
    player2: [
        ["1", "0", "0"],
        ["1", "1", "0"],
        ["1", "2", "0"],
        ["1", "3", "0"],
        ["1", "4", "0"]
    ]
}

// shots alice to hit / bob to miss
const game1_shots = {
    player1: [
        [1, 0], [2, 0], [3, 0], [4, 0], [5, 0],
        [1, 1], [2, 1], [3, 1], [4, 1],
        [1, 2], [2, 2], [3, 2],
        [1, 3], [2, 3], [3, 3],
        [1, 4], [2, 4]
    ],
    player2: [
        [9, 9], [9, 8], [9, 7], [9, 6], [9, 5],
        [9, 4], [9, 3], [9, 2], [9, 1],
        [9, 0], [8, 9], [8, 8],
        [8, 7], [8, 6], [8, 5],
        [8, 4]
    ]
}

describe("Play game1 to completion", async () => {
       
    let alice, bob;  // players
    let game;        // GameSimulation instance
    let alice_host;  // BattleshipClient instance for the host
    let bob_joiner;  // BattleshipClient instance for the joiner
     
    before(async () => {
        
        // set players
        alice = "Alice_Address_game1";
        bob = "Bob_Address_game1";
        
        // initialize and store game instance
        game = await GameSimulation.initialize();
        alice_host = await BattleShipClient.initialize(alice, game1_boards.player1);
        bob_joiner = await BattleShipClient.initialize(bob, game1_boards.player2);
        
    });
    
    it("Start a new game", async () => {
        
        // Player1: Alice hosts a new game
        const host_data = await alice_host.newGameData();
        await game.newGame(host_data);  
        
        expect(game.gameData.players[0]).to.equals(alice);
        expect(game.gameData.players[1]).to.equals('');
        expect(game.gameData.joinable).to.equals(true);
        expect(game.gameData.boards[0]).to.equals(alice_host.boardHash);
        
    })

    it("Join an existing game", async () => {

        // Player2: Bob joins the game
        const joiner_data = await bob_joiner.joinGameData(1);
        await game.joinGame(joiner_data);
        
        expect(game.gameData.players[0]).to.equals(alice); 
        expect(game.gameData.players[1]).to.equals(bob);
        expect(game.gameData.joinable).to.equals(false);
        expect(game.gameData.boards[0]).to.equals(alice_host.boardHash);
        expect(game.gameData.boards[1]).to.equals(bob_joiner.boardHash); 
    })

    it("Expect shared key hashes to be compliant", async () => {

        await alice_host.genSharedKey(game.gameData);
        await bob_joiner.genSharedKey(game.gameData);
        const sharedKeyHashes = game.gameData.sharedKeys;
        expect(sharedKeyHashes[alice]).to.equals(sharedKeyHashes[bob]);
        
    })

    it("opening shot", async () => {
        
        // Player1: Alice plays the opening shot
        const openingShot = await alice_host.openingShot(1, [1, 0]);
        await game.firstTurn(openingShot);

        expect(game.gameData.players[0]).to.equals(alice); 
        expect(game.gameData.players[1]).to.equals(bob);
        expect(game.gameData.joinable).to.equals(false);
        expect(game.gameData.boards[0]).to.equals(alice_host.boardHash);
        expect(game.gameData.boards[1]).to.equals(bob_joiner.boardHash); 
        expect(game.gameData.turns).to.equals(1);
        expect(game.gameData.shots[0]).to.deep.equal(openingShot.opening_shot_encrypted);
        //expect(game.gameData.hitNonce).to.not.include(1);
    })
    
    it('Prove hit/ miss for 32 turns', async () => {
        
        for (let player1_nonce = 1; player1_nonce <= 16; player1_nonce++) {

            /**
             * Simulate one guaranteed hit and one guaranteed miss played in the game
             * 
             * @param player1_nonce number - number of shots alice has already taken
             *  - range should be 1 through 16 for structured test
             */

            printLog(`Bob reporting result of Alice shot #${player1_nonce - 1} (Turn ${player1_nonce * 2 - 1})`)
            /// BOB PROVES ALICE PREVIOUS REGISTERED SHOT HIT ///
            // bob's shot hit/miss integrity proof public / private inputs
            
            let bob_turn = await bob_joiner.turnData(

                1,                                                        // gameID                          
                game1_shots.player2[player1_nonce - 1],                   // next shot from bob to alice
                game.gameData.shots[game.gameData.turns - 1][1],          // alice shot to verify
                game.gameData.shots[game.gameData.turns - 1][0]           // nonce for poseidon decryption
            ); 
            
            // prove alice's registered shot hit, and register bob's next shot
            await game.turn(bob_turn);
            
            
            /// ALICE PROVES BOB PREV REGISTERED SHOT MISSED ///
            printLog(`Alice reporting result of Bob shot #${player1_nonce - 1} (Turn ${player1_nonce * 2})`)
            // bob's shot hit/miss integrity proof public / private inputs
            
            let alice_turn = await alice_host.turnData(

                1,                                                   // gameID
                game1_shots.player1[player1_nonce],                  // next shot from alice to bob
                game.gameData.shots[game.gameData.turns - 1][1],     // bob shot to verify
                game.gameData.shots[game.gameData.turns - 1][0]      // nonce for poseidon decryption
            );
            
            // prove bob's registered shot missed, and register alice's next shot
            await game.turn(alice_turn);
            
        }   
        
    })

    it('Alice wins on sinking all of Bob\'s ships', async () => {

        bob_joiner.printGameData(game.gameData);

        // bob's shot hit/miss integrity proof public / private inputs
        let bob_turn = await bob_joiner.turnData(

            1,                                                       // gameID                          
            [0, 0],                                                  // next shot from bob to alice
            game.gameData.shots[game.gameData.turns - 1][1],         // alice shot to verify
            game.gameData.shots[game.gameData.turns - 1][0]          // nonce for poseidon decryption
        ); 
        
        // prove alice's registered shot hit, and register bob's next shot
        await game.turn(bob_turn);
        
        expect(game.gameData.joinable).to.equals(false);
        expect(game.gameData.boards[0]).to.equals(alice_host.boardHash);
        expect(game.gameData.boards[1]).to.equals(bob_joiner.boardHash); 
        expect(game.gameData.turns).to.equals(33);       
        
    })

    it('finalize game', () => {
        console.log('gameData: ',game.gameData);
        alice_host.printGameData(game.gameData);
        game.finalizeGame(1);
        expect(game.gameData).to.be.null;
    })
})

// x, y, z (horizontal/ verical orientation) ship placements

const game2_boards = {
    player1: [
        ["4", "2", "1"],
        ["1", "1", "0"],
        ["8", "6", "1"],
        ["3", "9", "0"],
        ["6", "3", "1"]
    ],
    player2: [
        ["1", "8", "0"],
        ["0", "3", "1"],
        ["3", "1", "1"],
        ["8", "5", "1"],
        ["8", "9", "0"]
    ]
}

const game2_shots = {
    player1: [
        [1, 0], [2, 2], [0, 5], [0, 6], [0, 7],
        [0, 3], [2, 9], [6, 4], [3, 1], [3, 2],
        [3, 0], [3, 3], [3, 4], [4, 6], [2, 4],
        [6, 6], [5, 7], [5, 8], [5, 9], [4, 8],
        [3, 8], [2, 8], [1, 8], [6, 7], [7, 3]
    ],
    player2: [
        [0, 1], [1, 1], [2, 1], [3, 1], [4, 1],
        [5, 1], [4, 2], [4, 3], [4, 4], [4, 5],
        [4, 6], [7, 2], [6, 3], [7, 3], [6, 4],
        [0, 8], [3, 9], [4, 9], [5, 9], [0, 0],
        [9, 6], [8, 5], [8, 6], [8, 7], [8, 8]
    ]
}

describe("Play game2 to completion", async () => {
       
    let alice, bob;  // players
    let game;        // GameSimulation instance
    let alice_host;  // BattleshipClient instance for the host
    let bob_joiner;  // BattleshipClient instance for the joiner
     
    before(async () => {
        
        // set players
        alice = "Alice_Address_game2";
        bob = "Bob_Address_game2";
        
        // initialize and store game instance
        game = await GameSimulation.initialize();
        alice_host = await BattleShipClient.initialize(alice, game2_boards.player1);
        bob_joiner = await BattleShipClient.initialize(bob, game2_boards.player2);
        
    });
    
    it("Start a new game", async () => {
        
        // Player1: Alice hosts a new game
        const host_data = await alice_host.newGameData();
        await game.newGame(host_data);  
        
        expect(game.gameData.players[0]).to.equals(alice);
        expect(game.gameData.players[1]).to.equals('');
        expect(game.gameData.joinable).to.equals(true);
        expect(game.gameData.boards[0]).to.equals(alice_host.boardHash);
        
    })

    it("Join an existing game", async () => {

        // Player2: Bob joins the game
        const joiner_data = await bob_joiner.joinGameData(1);
        await game.joinGame(joiner_data);
        
        expect(game.gameData.players[0]).to.equals(alice); 
        expect(game.gameData.players[1]).to.equals(bob);
        expect(game.gameData.joinable).to.equals(false);
        expect(game.gameData.boards[0]).to.equals(alice_host.boardHash);
        expect(game.gameData.boards[1]).to.equals(bob_joiner.boardHash); 
    })

    it("Expect shared key hashes to be compliant", async () => {

        await alice_host.genSharedKey(game.gameData);
        await bob_joiner.genSharedKey(game.gameData);
        const sharedKeyHashes = game.gameData.sharedKeys;
        expect(sharedKeyHashes[alice]).to.equals(sharedKeyHashes[bob]);
        
    })

    it("opening shot", async () => {
        
        // Player1: Alice plays the opening shot
        const openingShot = await alice_host.openingShot(1, [1, 0]);
        await game.firstTurn(openingShot);

        expect(game.gameData.players[0]).to.equals(alice); 
        expect(game.gameData.players[1]).to.equals(bob);
        expect(game.gameData.joinable).to.equals(false);
        expect(game.gameData.boards[0]).to.equals(alice_host.boardHash);
        expect(game.gameData.boards[1]).to.equals(bob_joiner.boardHash); 
        expect(game.gameData.turns).to.equals(1);
        expect(game.gameData.shots[0]).to.deep.equal(openingShot.opening_shot_encrypted);
    })
    
    it('Prove hit/ miss for 58 turns', async () => {
        for (let player1_nonce = 1; player1_nonce <= 24; player1_nonce++) {

           
            printLog(`Bob reporting result of Alice shot #${player1_nonce - 1} (Turn ${player1_nonce * 2 - 1})`)
            /// BOB PROVES ALICE PREVIOUS REGISTERED SHOT HIT ///
            // bob's shot hit/miss integrity proof public / private inputs
            let bob_turn = await bob_joiner.turnData(

                1,                                                        // gameID                          
                game2_shots.player2[player1_nonce - 1],                   // next shot from bob to alice
                game.gameData.shots[game.gameData.turns - 1][1],          // alice shot to verify
                game.gameData.shots[game.gameData.turns - 1][0]           // nonce for poseidon decryption
            ); 

            // prove alice's registered shot hit, and register bob's next shot
            await game.turn(bob_turn);
        
            
            /// ALICE PROVES BOB PREV REGISTERED SHOT MISSED ///
            printLog(`Alice reporting result of Bob shot #${player1_nonce - 1} (Turn ${player1_nonce * 2})`)
            // bob's shot hit/miss integrity proof public / private inputs
            let alice_turn = await alice_host.turnData(

                1,                                                   // gameID
                game2_shots.player1[player1_nonce],                  // next shot from alice to bob
                game.gameData.shots[game.gameData.turns - 1][1],     // bob shot to verify
                game.gameData.shots[game.gameData.turns - 1][0]      // nonce for poseidon decryption
            );
            
            // prove bob's registered shot missed, and register alice's next shot
            await game.turn(alice_turn);
        }   
    })

    it('Bob wins on sinking all of Alice\'s ships', async () => {
        //console.log('gameData: ',game.gameData);
        
        let bob_turn = await bob_joiner.turnData(

            1,                                                        // gameID                          
            game2_shots.player2[24],                                  // next shot from bob to alice
            game.gameData.shots[game.gameData.turns - 1][1],          // alice shot to verify
            game.gameData.shots[game.gameData.turns - 1][0]           // nonce for poseidon decryption
        );

        // prove alice's registered shot hit, and register bob's next shot
        await game.turn(bob_turn);
        
        let alice_turn = await alice_host.turnData(

            1,                                                       // gameID                          
            [0, 0],                                                  // next shot from alice to bob
            game.gameData.shots[game.gameData.turns - 1][1],         // bob shot to verify
            game.gameData.shots[game.gameData.turns - 1][0]          // nonce for poseidon decryption
        );
        
        // prove bob's registered shot hit, and register bob's next shot
        await game.turn(alice_turn);
        bob_joiner.printGameData(game.gameData);

        expect(game.gameData.joinable).to.equals(false);
        expect(game.gameData.boards[0]).to.equals(alice_host.boardHash);
        expect(game.gameData.boards[1]).to.equals(bob_joiner.boardHash); 
        expect(game.gameData.turns).to.equals(50);
        //expect(game.gameData.winner).to.deep.equal(bob);        

    })

    it('finalize game', () => {
        console.log('Game State: ',game.gameData);
        alice_host.printGameData(game.gameData);
        game.finalizeGame(1);
        expect(game.gameData).to.be.null;
    })
})

function randomShot(): number[] {
    let random_shot = [
        Math.floor(Math.random() * 10),
        Math.floor(Math.random() * 10)
    ];
    return random_shot
}

const alice_random_shots = [];
const bob_random_shots = [];
for (let i=0; i<100; i++) {
    alice_random_shots.push(randomShot());
    bob_random_shots.push(randomShot());
}

const game2_random_shots = {
    player1: alice_random_shots,
    player2: bob_random_shots
}

describe("Play game2_random shots to completion", async () => {
       
    let alice, bob;  // players
    let game;        // GameSimulation instance
    let alice_host;  // BattleshipClient instance for the host
    let bob_joiner;  // BattleshipClient instance for the joiner

    before(async () => {
        
        // set players
        alice = "Alice_Address_game2";
        bob = "Bob_Address_game2";
        
        // initialize and store game instance
        ( game = await GameSimulation.initialize() );
        ( alice_host = await BattleShipClient.initialize(alice, game2_boards.player1));
        ( bob_joiner = await BattleShipClient.initialize(bob, game2_boards.player2));
        
    });
    
    it("Start a new game", async () => {
        
        // Player1: Alice hosts a new game
        const host_data = await alice_host.newGameData();
        await game.newGame(host_data);  
        
        expect(game.gameData.players[0]).to.equals(alice);
        expect(game.gameData.players[1]).to.equals('');
        expect(game.gameData.joinable).to.equals(true);
        expect(game.gameData.boards[0]).to.equals(alice_host.boardHash);
        
    })

    it("Join an existing game", async () => {

        // Player2: Bob joins the game
        const joiner_data = await bob_joiner.joinGameData(1);
        await game.joinGame(joiner_data);
        
        expect(game.gameData.players[0]).to.equals(alice); 
        expect(game.gameData.players[1]).to.equals(bob);
        expect(game.gameData.joinable).to.equals(false);
        expect(game.gameData.boards[0]).to.equals(alice_host.boardHash);
        expect(game.gameData.boards[1]).to.equals(bob_joiner.boardHash); 
    })

    it("Expect shared key hashes to be compliant", async () => {

        await alice_host.genSharedKey(game.gameData);
        await bob_joiner.genSharedKey(game.gameData);
        const sharedKeyHashes = game.gameData.sharedKeys;
        expect(sharedKeyHashes[alice]).to.equals(sharedKeyHashes[bob]);
        
    })

    it("opening shot", async () => {
        
        // Player1: Alice plays the opening shot
        const openingShot = await alice_host.openingShot(1, game2_random_shots.player1[0]);
        await game.firstTurn(openingShot);
        
        expect(game.gameData.players[0]).to.equals(alice); 
        expect(game.gameData.players[1]).to.equals(bob);
        expect(game.gameData.joinable).to.equals(false);
        expect(game.gameData.boards[0]).to.equals(alice_host.boardHash);
        expect(game.gameData.boards[1]).to.equals(bob_joiner.boardHash); 
        expect(game.gameData.turns).to.equals(1);
        expect(game.gameData.shots[0]).to.deep.equal(openingShot.opening_shot_encrypted);
    })
    
    it('Prove hit/ miss for ## turns', async () => {
        
        let player1_nonce = 1;
        
        while (game.gameData.winner == '') {
            
            printLog(`Bob reporting result of Alice shot #${player1_nonce - 1} (Turn ${player1_nonce * 2 - 1})`)
            /// BOB PROVES ALICE PREVIOUS REGISTERED SHOT HIT ///
            // bob's shot hit/miss integrity proof public / private inputs
            let bob_turn = await bob_joiner.turnData(

                1,                                                        // gameID                          
                game2_random_shots.player2[player1_nonce - 1],            // next shot from bob to alice
                game.gameData.shots[game.gameData.turns - 1][1],          // alice shot to verify
                game.gameData.shots[game.gameData.turns - 1][0]           // nonce for poseidon decryption
            ); 

            // prove alice's registered shot hit, and register bob's next shot
            await game.turn(bob_turn);
        
            /// ALICE PROVES BOB PREV REGISTERED SHOT MISSED ///
            printLog(`Alice reporting result of Bob shot #${player1_nonce - 1} (Turn ${player1_nonce * 2})`)
            // bob's shot hit/miss integrity proof public / private inputs
            let alice_turn = await alice_host.turnData(

                1,                                                        // gameID
                game2_random_shots.player1[player1_nonce],                // next shot from alice to bob
                game.gameData.shots[game.gameData.turns - 1][1],     // bob shot to verify
                game.gameData.shots[game.gameData.turns - 1][0]      // nonce for poseidon decryption
            );
            
            // prove bob's registered shot missed, and register alice's next shot
            await game.turn(alice_turn);

            player1_nonce++;
        }   
        
    })

    it('finalize game', () => {
        alice_host.printGameData(game.gameData);
        bob_joiner.printGameData(game.gameData);
        game.finalizeGame(1);
        expect(game.gameData).to.be.null;
    })
})