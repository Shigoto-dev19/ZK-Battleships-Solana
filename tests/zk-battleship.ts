import * as anchor from '@project-serum/anchor';
import { AnchorError, Program } from '@project-serum/anchor';
import { ZkBattleship } from '../target/types/zk_battleship';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { expect } from 'chai';
import { BattleShipClient } from '../src/battleshipClient';
import { genKeypair } from 'maci-crypto';
const { buildPoseidonOpt } = require("circomlibjs");
chai.use(chaiAsPromised);

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

describe('ZkBattleship', () => {
  

  // instantiate client class
  let alice_host;
  
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.ZkBattleship as Program<ZkBattleship>;
  const programProvider = program.provider as anchor.AnchorProvider;
  before(async () => {
        
    const poseidon = await buildPoseidonOpt();
    let F = poseidon.F;
    
});

  it('new game!', async() => {
    
    

    const gameKeypair = anchor.web3.Keypair.generate();
    const playerOne = programProvider.wallet;
    const playerTwo = anchor.web3.Keypair.generate();

    alice_host = await BattleShipClient.initialize(playerOne.publicKey.toString(), game1_boards.player1);
    
    // prepare board hash for the program input
    let boardHash = alice_host.hash_board(game1_boards.player1);
    boardHash = BattleShipClient.F.toObject(boardHash).toString();
    const board_Hash: Array<number> = new anchor.BN(boardHash).toArray("be", 32);
    // prepare encryption public key for the program input
    let host_pubkey: Array<BigInt> = genKeypair().pubKey;
    //console.log('host pubkey: ',host_pubkey);
    let host_encryption_pubkey = host_pubkey.map((x) => x.toString());
    let host_encryption_pubkey1: Array<number> = new anchor.BN(host_encryption_pubkey[0]).toArray("be", 32);
    let host_encryption_pubkey2: Array<number> = new anchor.BN(host_encryption_pubkey[1]).toArray("be", 32);
    const host_encryption_pk: number[][] = [host_encryption_pubkey1, host_encryption_pubkey2];
    await program.methods
      .newGame(
        {
          boardHash: board_Hash,
          hostEncryptionPubkey: host_encryption_pk,
        })
      .accounts({
        game: gameKeypair.publicKey,
        player1Host: playerOne.publicKey,
      })
      .signers([gameKeypair])
      .rpc();

    let gameState = await program.account.game.fetch(gameKeypair.publicKey);
    expect(gameState.turns).to.equal(0);
    expect(gameState.players[0])
      .to
      .eql(playerOne.publicKey);
    expect(gameState.state).to.eql({ readyToStart: {} });
    expect(gameState.boards[0])
      .to
      .eql(board_Hash);
    expect(gameState.joinable).to.eql(true);
  });
});
