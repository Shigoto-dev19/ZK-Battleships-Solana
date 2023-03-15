import * as anchor from '@project-serum/anchor';
import { AnchorError, Program } from '@project-serum/anchor';
import { ZkBattleship } from '../target/types/zk_battleship';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { expect } from 'chai';
import { BattleShipClient } from '../src/battleshipClient';
const { buildPoseidonOpt } = require("circomlibjs");
import { poseidon_decrypt } from '../src/utils'

chai.use(chaiAsPromised);

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
      [8, 4], [8, 5]
  ]
}

async function play(program: Program<ZkBattleship>, game, player, turnData) {
  await program.methods
    .play(turnData)
    .accounts({
      player: player.publicKey,
      game
    })
    .signers(player instanceof (anchor.Wallet as any) ? [] : [player])
    .rpc();

  // const gameState = await program.account.game.fetch(game);
  // expect(gameState.turns).to.equal(expectedTurn);
  // expect(gameState.state).to.eql(expectedGameState);
  // expect(gameState.boards)
  //   .to
  //   .eql(expectedBoard);
}

describe('ZkBattleship: Game1', () => {
  
  // instantiate client class
  let alice_host;
  let bob_joiner;

  let program;
  let programProvider;
  let gameKeypair;
  let playerOne;
  let playerTwo;
  let gameState;

  before(async () => {
        
    const poseidon = await buildPoseidonOpt();
    let F = poseidon.F;

    // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env());

    program = anchor.workspace.ZkBattleship as Program<ZkBattleship>;
    programProvider = program.provider as anchor.AnchorProvider;
    
    gameKeypair = anchor.web3.Keypair.generate();
    playerOne = programProvider.wallet;
    playerTwo = anchor.web3.Keypair.generate();

    alice_host = await BattleShipClient.initialize(
      playerOne.publicKey.toString(),
      game1_boards.player1
    );

    bob_joiner = await BattleShipClient.initialize(
      playerTwo.publicKey.toString(),
      game1_boards.player2
    );
    
});

  it('new game!', async() => {

    const host_data = await alice_host.newGameData();
   
    try {
      await program.methods
      .newGame(host_data)
      .accounts({
        game: gameKeypair.publicKey,
        player1Host: playerOne.publicKey,
      })
      .signers([gameKeypair])
      .rpc();
  
      gameState = await program.account.game.fetch(gameKeypair.publicKey);

      alice_host.printGameData(gameState);
      expect(gameState.turns).to.equal(0);
      expect(gameState.players[0])
        .to
        .eql(playerOne.publicKey);
      expect(gameState.state).to.eql({ readyToStart: {} });
      expect(gameState.boards[0])
        .to
        .eql(host_data.boardHash);
      expect(gameState.joinable).to.eql(true);
      expect(gameState.encryptionPk[0]).to.eql(host_data.hostEncryptionPubkey);

    } catch (error) {
      console.log(error)
    }
    
  });

  it('join game!', async() => {
  
    const joiner_data = await bob_joiner.joinGameData();
    
    await program.methods
      .joinGame(joiner_data)
      .accounts({
        game: gameKeypair.publicKey,
        player2Joiner: playerTwo.publicKey,
      })
      .signers(playerTwo instanceof (anchor.Wallet as any) ? [] : [playerTwo])
      .rpc();

    gameState = await program.account.game.fetch(gameKeypair.publicKey);

    // the players generate their shared keys according to their adversary's public key
    await bob_joiner.genSharedKey(gameState);
    await alice_host.genSharedKey(gameState);
    expect(alice_host.sharedKey).to.eql(bob_joiner.sharedKey);

    expect(gameState.turns).to.equal(0);
    expect(gameState.players[1])
      .to
      .eql(playerTwo.publicKey);
    expect(gameState.state).to.eql({ readyToStart: {} });
    expect(gameState.boards[1])
      .to
      .eql(joiner_data.boardHash);
    expect(gameState.joinable).to.eql(false);
    expect(gameState.encryptionPk[1]).to.eql(joiner_data.joinerEncryptionPubkey);

  });

  it('play opening shot!', async () => {
    
    const openingShot = await alice_host.openingShot(game1_shots.player1[0]);
    await program.methods
      .playOpeningShot(
        openingShot
      )
      .accounts({
        game: gameKeypair.publicKey,
        player: playerOne.publicKey,
      })
      .signers(playerOne instanceof (anchor.Wallet as any) ? [] : [playerOne])
      .rpc();

    gameState = await program.account.game.fetch(gameKeypair.publicKey);
    
    expect(gameState.turns).to.equal(1);
    expect(gameState.players[0])
      .to
      .eql(playerOne.publicKey);
    expect(gameState.state).to.eql({ ongoing: {} });
    expect(gameState.shots)
      .to
      .eql(openingShot.shot);
    expect(gameState.joinable).to.eql(false);
    const decrypted_shot = poseidon_decrypt(gameState.shots, alice_host.sharedKey);
    expect(decrypted_shot).to.eql(game1_shots.player1[0]);
    
  })

  it('play turn!', async() => {

    try {
      
      for (let player1_nonce = 1; player1_nonce <= 16; player1_nonce++) {

        printLog(`Bob reporting result of Alice shot #${player1_nonce - 1} (Turn ${player1_nonce * 2 - 1})`)
        /// BOB PROVES ALICE PREVIOUS REGISTERED SHOT HIT ///
        // bob's shot hit/miss integrity proof public / private inputs
        gameState = await program.account.game.fetch(gameKeypair.publicKey);
        
        let bob_turnData = await bob_joiner.turnData(
          game1_shots.player2[player1_nonce - 1],                   // next shot from bob to alice
          gameState.shots,                                          // alice shot to verify
          gameState.hits
        ); 
        
        // prove alice's registered shot hit, and register bob's next shot
        await play(program, gameKeypair.publicKey, playerTwo, bob_turnData);
        
        /// ALICE PROVES BOB PREV REGISTERED SHOT MISSED ///
        printLog(`Alice reporting result of Bob shot #${player1_nonce - 1} (Turn ${player1_nonce * 2})`)
        // bob's shot hit/miss integrity proof public / private inputs
        
        gameState = await program.account.game.fetch(gameKeypair.publicKey);
        
        let alice_turnData = await alice_host.turnData(
          game1_shots.player1[player1_nonce],                   // next shot from bob to alice
          gameState.shots,                                      // alice shot to verify
          gameState.hits
        ); 
        
        // prove bob's registered shot missed, and register alice's next shot
        await play(program, gameKeypair.publicKey, playerOne, alice_turnData);
        
      }   
      gameState = await program.account.game.fetch(gameKeypair.publicKey);
    
    } catch (error) {
        console.log(error)
    }
  })

  it('Alice wins on sinking all of Bob\'s ships', async () => {

    gameState = await program.account.game.fetch(gameKeypair.publicKey);
      
    let bob_turnData = await bob_joiner.turnData(
      game1_shots.player2[16],                          // next shot from bob to alice
      gameState.shots,                                  // alice shot to verify
      gameState.hits
    ); 
      
    // prove alice's registered shot hit, and register bob's next shot
    await play(program, gameKeypair.publicKey, playerTwo, bob_turnData);
    
    gameState = await program.account.game.fetch(gameKeypair.publicKey);
    expect(gameState.joinable).to.equals(false);
    expect(gameState.boards[0]).to.eql(alice_host.parsed_boardHash);
    expect(gameState.boards[1]).to.eql(bob_joiner.parsed_boardHash); 
    expect(gameState.turns).to.equals(33);    
    expect(gameState.state).to.eql({ won: { winner: playerOne.publicKey }, });

    await bob_joiner.printGameData(gameState);
    await alice_host.printGameData(gameState);

  })

  it('finalize game1', async() => {
    
    await program.methods
      .finalizeGame()
      .accounts({
        game: gameKeypair.publicKey,
        player: playerOne.publicKey,
      })
      .signers(playerOne instanceof (anchor.Wallet as any) ? [] : [playerOne])
      .rpc();
      
    const game_publicKey = gameKeypair.publicKey.toString();

    try {  
      gameState = await program.account.game.fetch(gameKeypair.publicKey);
      
    } catch (_err) {
      expect(_err.toString()).to.include('Account does not exist ' + game_publicKey);
    } 
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
describe('ZkBattleship: Game2', () => {
  
  // instantiate client class
  let alice_host;
  let bob_joiner;

  let program;
  let programProvider;
  let gameKeypair;
  let playerOne;
  let playerTwo;
  let gameState;

  before(async () => {
        
    const poseidon = await buildPoseidonOpt();
    let F = poseidon.F;

      // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env());

    program = anchor.workspace.ZkBattleship as Program<ZkBattleship>;
    programProvider = program.provider as anchor.AnchorProvider;
    

    gameKeypair = anchor.web3.Keypair.generate();
    playerOne = programProvider.wallet;
    playerTwo = anchor.web3.Keypair.generate();

    alice_host = await BattleShipClient.initialize(
      playerOne.publicKey.toString(),
      game2_boards.player1
    );

    bob_joiner = await BattleShipClient.initialize(
      playerTwo.publicKey.toString(),
      game2_boards.player2
    );
    
});

  it('new game2!', async() => {
    
    const host_data = await alice_host.newGameData();
    
    try {
      await program.methods
      .newGame(host_data)
      .accounts({
        game: gameKeypair.publicKey,
        player1Host: playerOne.publicKey,
      })
      .signers([gameKeypair])
      .rpc();

    gameState = await program.account.game.fetch(gameKeypair.publicKey);
    expect(gameState.turns).to.equal(0);
    expect(gameState.players[0])
      .to
      .eql(playerOne.publicKey);
    expect(gameState.state).to.eql({ readyToStart: {} });
    expect(gameState.boards[0])
      .to
      .eql(host_data.boardHash);
    expect(gameState.joinable).to.eql(true);
    expect(gameState.encryptionPk[0]).to.eql(host_data.hostEncryptionPubkey);

    } catch (error) {
      console.log(error)
    }
    
  });

  it('join game!', async() => {
  
    const joiner_data = await bob_joiner.joinGameData();
    
    await program.methods
      .joinGame(joiner_data)
      .accounts({
        game: gameKeypair.publicKey,
        player2Joiner: playerTwo.publicKey,
      })
      .signers(playerTwo instanceof (anchor.Wallet as any) ? [] : [playerTwo])
      .rpc();

    gameState = await program.account.game.fetch(gameKeypair.publicKey);

    // the players generate their shared keys according to their adversary's public key
    await bob_joiner.genSharedKey(gameState);
    await alice_host.genSharedKey(gameState);
    expect(alice_host.sharedKey).to.eql(bob_joiner.sharedKey);

    expect(gameState.turns).to.equal(0);
    expect(gameState.players[1])
      .to
      .eql(playerTwo.publicKey);
    expect(gameState.state).to.eql({ readyToStart: {} });
    expect(gameState.boards[1])
      .to
      .eql(joiner_data.boardHash);
    expect(gameState.joinable).to.eql(false);
    expect(gameState.encryptionPk[1]).to.eql(joiner_data.joinerEncryptionPubkey);
    

  });

  it('play opening shot!', async () => {
    
    const openingShot = await alice_host.openingShot(game2_shots.player1[0]);
    await program.methods
      .playOpeningShot(
        openingShot
      )
      .accounts({
        game: gameKeypair.publicKey,
        player: playerOne.publicKey,
      })
      .signers(playerOne instanceof (anchor.Wallet as any) ? [] : [playerOne])
      .rpc();

    gameState = await program.account.game.fetch(gameKeypair.publicKey);
    
    expect(gameState.turns).to.equal(1);
    expect(gameState.players[0])
      .to
      .eql(playerOne.publicKey);
    expect(gameState.state).to.eql({ ongoing: {} });
    expect(gameState.shots)
      .to
      .eql(openingShot.shot);
    expect(gameState.joinable).to.eql(false);
    const decrypted_shot = poseidon_decrypt(gameState.shots, alice_host.sharedKey);
    expect(decrypted_shot).to.eql(game2_shots.player1[0]);
    
  })

  it('Prove hit/ miss for 48 turns', async() => {

    //const player_turnData = await bob_joiner.turnData(player_shot: number[], enemy_shot: number[][])
    try {
      
      for (let player1_nonce = 1; player1_nonce <= 24; player1_nonce++) {

        printLog(`Bob reporting result of Alice shot #${player1_nonce - 1} (Turn ${player1_nonce * 2 - 1})`)
        /// BOB PROVES ALICE PREVIOUS REGISTERED SHOT HIT ///
        // bob's shot hit/miss integrity proof public / private inputs
        gameState = await program.account.game.fetch(gameKeypair.publicKey);
        
        let bob_turnData = await bob_joiner.turnData(
          game2_shots.player2[player1_nonce - 1],                   // next shot from bob to alice
          gameState.shots,                                          // alice shot to verify
          gameState.hits
        ); 
        
        // prove alice's registered shot hit, and register bob's next shot
        await play(program, gameKeypair.publicKey, playerTwo, bob_turnData);
        
        /// ALICE PROVES BOB PREV REGISTERED SHOT MISSED ///
        printLog(`Alice reporting result of Bob shot #${player1_nonce - 1} (Turn ${player1_nonce * 2})`)
        // bob's shot hit/miss integrity proof public / private inputs
        
        gameState = await program.account.game.fetch(gameKeypair.publicKey);
        
        let alice_turnData = await alice_host.turnData(
          game2_shots.player1[player1_nonce],                   // next shot from bob to alice
          gameState.shots,                                      // alice shot to verify
          gameState.hits
        ); 
        
        // prove bob's registered shot missed, and register alice's next shot
        await play(program, gameKeypair.publicKey, playerOne, alice_turnData); 
      }   

    } catch (error) {
        console.log(error)
    }
  })

  it('Bob wins on sinking all of Alice\'s ships', async () => {

    gameState = await program.account.game.fetch(gameKeypair.publicKey);
    
    let bob_turnData = await bob_joiner.turnData(
      game2_shots.player2[24],                          // next shot from bob to alice
      gameState.shots,                                  // alice shot to verify
      gameState.hits
    ); 
    
    // prove alice's registered shot hit, and register bob's next shot
    await play(program, gameKeypair.publicKey, playerTwo, bob_turnData);
    
    gameState = await program.account.game.fetch(gameKeypair.publicKey);
      
    let alice_turnData = await alice_host.turnData(
      [0, 0],                                           // next shot from alice to bob
      gameState.shots,                                  // bob shot to verify
      gameState.hits
    ); 
    
    // prove alice's registered shot hit, and register bob's next shot
    await play(program, gameKeypair.publicKey, playerOne, alice_turnData);

    gameState = await program.account.game.fetch(gameKeypair.publicKey);
    expect(gameState.joinable).to.equals(false);
    expect(gameState.boards[0]).to.eql(alice_host.parsed_boardHash);
    expect(gameState.boards[1]).to.eql(bob_joiner.parsed_boardHash); 
    expect(gameState.turns).to.equals(50);    
    expect(gameState.state).to.eql({ won: { winner: playerTwo.publicKey }, });
    
    await bob_joiner.printGameData(gameState);
    await alice_host.printGameData(gameState);
    
  })

  it('finalize game2', async() => {

    await program.methods
      .finalizeGame()
      .accounts({
        game: gameKeypair.publicKey,
        player: playerOne.publicKey,
      })
      .signers(playerOne instanceof (anchor.Wallet as any) ? [] : [playerOne])
      .rpc();
      
      const game_publicKey = gameKeypair.publicKey.toString();

      try {  
        gameState = await program.account.game.fetch(gameKeypair.publicKey);
      } catch (_err) {
        expect(_err.toString()).to.include('Account does not exist ' + game_publicKey);
      } 
  })
}) 

