import * as anchor from '@project-serum/anchor';
import { poseidonEncrypt, poseidonDecrypt, genRandomNonce } from '../src/poseidonEnc';

const { unstringifyBigInts, leInt2Buff, leBuff2int } = require('ffjavascript').utils;
const ff = require('ffjavascript');


function hitScan(board: string[][], shot: number[]) {

  function hitCheck(n: number, ship: string[], shot: number[]): number {
    let _ship = ship.map((xy) => Number(xy));
    if (_ship[2] === 0) {
      let hHit = 0;
      for (let i = 0; i < n; i++) {
          let _x = (_ship[0] + i === shot[0]) ? 1 : 0;
          let _y = (_ship[1] === shot[1]) ? 1 : 0;
          let check = (_x === 1 && _y === 1) ? 1 : 0;
          hHit += 1 * check;
      }
      return hHit
    } else {
      var vHit = 0;
      for (let i = 0; i < n; i++) {
          let _x = (_ship[0] === shot[0]) ? 1 : 0;
          let _y = (_ship[1] + i === shot[1]) ? 1 : 0;
          let check = (_x === 1 && _y === 1) ? 1 : 0;
          vHit += 1 * check;
      }
      return vHit
    }
  }
  /// HIT SCAN ///
  let lengths = [5, 4, 3, 3, 2];
  // scan for hits //
  let hitResult = 0;
  for (var i = 0; i < 5; i++) {
    hitResult |= hitCheck(lengths[i], board[i], shot);
  }
  return hitResult  
  
}

function parse_32_bytes(input: any) {
    return new anchor.BN(input).toArray("be", 32);
  }

function parse_poseidon_pk(public_key: BigInt[]): number[][] {

    let encryption_pubkey = public_key.map((x) => x.toString());
    const encryption_pubkey1: Array<number> = new anchor.BN(encryption_pubkey[0]).toArray("be", 32);
    const encryption_pubkey2: Array<number> = new anchor.BN(encryption_pubkey[1]).toArray("be", 32);
    const poseidon_encryption_pk: number[][] = [encryption_pubkey1, encryption_pubkey2];

    return poseidon_encryption_pk
}

/// poseidon encryption of the player's shot
/// returns parsed format for the solana program transaction
function poseidon_encrypt(plaintext: number[], pubKey: BigInt[], nonce?: BigInt ): number[][] {
    
  let shot_encryption_nonce;
  if (nonce) shot_encryption_nonce = nonce;
  else shot_encryption_nonce = genRandomNonce();

  const encrypted_shot = poseidonEncrypt(
    plaintext.map((x) => BigInt(x)), 
    pubKey, 
    shot_encryption_nonce
  )

  let array_encrypted: string[] = [
    shot_encryption_nonce.toString(),
      ...encrypted_shot.map((x) => x.toString())
  ]
  let result = parseToBytesArray(array_encrypted);

  return result
}

function prepare_shotProof_input(
  F: any,
  board: string[][],
  boardHash: any,
  enemy_shot: number[][],
  sharedKey: BigInt[],
  
) {
  //decrypt and retrieve enemy's encryption nonce and the decrypted shot
  const decrypted_shot = poseidon_decrypt(enemy_shot, sharedKey);
  let hit = hitScan(board, decrypted_shot);
  
  const parsed_enemy_shot = parseToStringArray(enemy_shot.map((x) => x.reverse()));
  const nonce = parsed_enemy_shot[0];
  const ciphertext = parsed_enemy_shot.slice(1); 

  // enemy's shot hit/miss integrity proof public / private inputs
  let input_shot = {
      ships: board,
      hash: F.toObject(boardHash),
      encrypted_shot: ciphertext,
      nonce: nonce,
      key: sharedKey.map((x) => x.toString()),
      hit: hit
  }

  return { input_shot, decrypted_shot }
}

/// converts an array of bytes into a BigInt
function bytes_to_bigint(input: number[]): BigInt {
    return BigInt("0x" + input.map(b => b.toString(16).padStart(2, "0")).join(""));
}

/// poseidon decryption of the encrypted shot
/// returns the same format as the player input
function poseidon_decrypt(input: number[][], key: BigInt[], length?: number) {
    let l: number;
    if (length) l = length;
    else l = 2;

    const parsed_input = parseToStringArray(input);
    const nonce = BigInt(parsed_input[0]);
    const ciphertext = parsed_input.slice(1).map((x) => BigInt(x));                             
    
    let decrypted_input: any[] = poseidonDecrypt(
        ciphertext, 
        key, 
        nonce,
        l
    )
    decrypted_input = decrypted_input.map((x) => Number(x));

    return decrypted_input       
}

// also converts lE to BE
function parseProofToBytesArray(data: any) {
    var mydata = JSON.parse(data.toString());

    for (var i in mydata) {
      if (i == "pi_a" || i == "pi_c") {
        for (var j in mydata[i]) {
          mydata[i][j] = Array.from(
            leInt2Buff(unstringifyBigInts(mydata[i][j]), 32),
          ).reverse();
        }
      } else if (i == "pi_b") {
        for (var j in mydata[i]) {
          for (var z in mydata[i][j]) {
            mydata[i][j][z] = Array.from(
              leInt2Buff(unstringifyBigInts(mydata[i][j][z]), 32),
            );
          }
        }
      }
    }
   
    return {
      proofA: [mydata.pi_a[0], mydata.pi_a[1]].flat(),
      proofB: [
        mydata.pi_b[0].flat().reverse(),
        mydata.pi_b[1].flat().reverse(),
      ].flat(),
      proofC: [mydata.pi_c[0], mydata.pi_c[1]].flat(),
    };
}

function parseToBytesArray(publicSignals: Array<string>) {
      
    var publicInputsBytes = new Array<Array<number>>();
    for (var i in publicSignals) {
      let ref: Array<number> = Array.from([
        ...leInt2Buff(unstringifyBigInts(publicSignals[i]), 32),
      ]).reverse();
      publicInputsBytes.push(ref);
      
    }
    
    return publicInputsBytes
}

function parseToStringArray(input: number[][]): string[] {

  var stringArray: string[] = [];
  for (var i in input) {
    let ref: string = 
    leBuff2int(new Uint8Array(input[i].reverse())).toString();
    stringArray.push(ref);
  }
  
  return stringArray
}

export {
    parse_32_bytes,
    parse_poseidon_pk,
    poseidon_encrypt,
    bytes_to_bigint,
    poseidon_decrypt,
    parseProofToBytesArray,
    parseToBytesArray,
    prepare_shotProof_input,
    parseToStringArray
}

