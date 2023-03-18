import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { ZkBattleship } from '../../target/types/zk_battleship';
import { BattleShipClient } from '../../src/battleshipClient';


/// instantiate program and client class
async function hostGame(board: string[][]) {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  let program = anchor.workspace.ZkBattleship as Program<ZkBattleship>;
  let programProvider = program.provider as anchor.AnchorProvider;
  
  let gameKeypair = anchor.web3.Keypair.generate();
  
  let playerOne = programProvider.wallet;

  // instantiate program and client class
  let host = await BattleShipClient.initialize(
      playerOne.publicKey.toString(),
      board
  );

  const host_data = await host.newGameData();
 
  await program.methods
  .newGame(host_data)
  .accounts({
  game: gameKeypair.publicKey,
  player1Host: playerOne.publicKey,
  })
  .signers([gameKeypair])
  .rpc();

  let gameState = await program.account.game.fetch(gameKeypair.publicKey);
  
  return { 
    _host: host,
    _gameState: gameState, 
    _gamePK: gameKeypair.publicKey,
    _program: program,
    _playerOne: playerOne
  }
}

async function joinGame(board: string[][], gamePK) {

  let playerTwo = anchor.web3.Keypair.generate();
  let program = anchor.workspace.ZkBattleship as Program<ZkBattleship>;
  
  let joiner = await BattleShipClient.initialize(
    playerTwo.publicKey.toString(),
    board
  );

  const joiner_data = await joiner.joinGameData();
  
  await program.methods
    .joinGame(joiner_data)
    .accounts({
      game: gamePK,
      player2Joiner: playerTwo.publicKey,
    })
    .signers(playerTwo instanceof (anchor.Wallet as any) ? [] : [playerTwo])
    .rpc();

  let gameState = await program.account.game.fetch(gamePK);

  // the players generate their shared keys according to their adversary's public key
  await joiner.genSharedKey(gameState);
  
  return {
    _joiner: joiner,
    _playerTwo: playerTwo,
    _program: program,
    _gameState: gameState
  }
  
}

async function hostAttack(program, playerOne, host, game_publicKey, shot) {
  
  let gameState = await program.account.game.fetch(game_publicKey);
  host.printBoards();

  if (gameState.turns === 0) {
    await host.genSharedKey(gameState);
    const openingShot = await host.openingShot(shot);
    await program.methods
      .playOpeningShot(
        openingShot
      )
      .accounts({
        game: game_publicKey,
        player: playerOne.publicKey,
      })
      .signers(playerOne instanceof (anchor.Wallet as any) ? [] : [playerOne])
      .rpc();

    gameState = await program.account.game.fetch(game_publicKey);
    //host.printBoards();

    return gameState

  } else {
    let host_turnData = await host.turnData(

      shot,                   // next shot from host to joiner
      gameState.shots,        // joiner shot to verify
      gameState.hits          // encrypted previous hit result
  ); 
  
  await program.methods
  .play(host_turnData)
  .accounts({
    player: playerOne.publicKey,
    game_publicKey
  })
  .signers(playerOne instanceof (anchor.Wallet as any) ? [] : [playerOne])
  .rpc();

  gameState = await program.account.game.fetch(game_publicKey);
  host.printBoards();

  return {gameState, host}
  }
}

async function joinerAttack(program, playerTwo, joiner, game_publicKey, shot) {
  
    let gameState = await program.account.game.fetch(game_publicKey);
    //joiner.printBoards();
    let joiner_turnData = await joiner.turnData(

      shot,                   // next shot from joiner to host
      gameState.shots,        // host shot to verify
      gameState.hits          // encrypted previous hit result
    ); 

      await program.methods
      .play(joiner_turnData)
      .accounts({
        player: playerTwo.publicKey,
        game_publicKey
      })
      .signers(playerTwo instanceof (anchor.Wallet as any) ? [] : [playerTwo])
      .rpc();

    gameState = await program.account.game.fetch(game_publicKey);
    joiner.printBoards()

    return {_gameState: gameState, _joiner: joiner}
    
}

async function fetchMostRecentAccount(program: Program, provider: anchor.AnchorProvider) {
  const accounts = await program.account.game.all();
  if (accounts.length === 0) {
    throw new Error('No accounts found');
  }
  const mostRecentAccount = accounts.reduce((a, b) => a.slot > b.slot ? a : b);
  const publicKey = mostRecentAccount.publicKey;
  const accountInfo = await provider.connection.getAccountInfo(publicKey);
  if (accountInfo === null) {
    throw new Error('Account not found');
  }
  return publicKey;
}

export {
  hostGame,
  joinGame,
  hostAttack,
  joinerAttack
}


