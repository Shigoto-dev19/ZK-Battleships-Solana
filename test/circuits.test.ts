const { assert, expect } = require("chai");
const { snarkjs, fs, buildPoseidonOpt } = require('../src/utils');
const path = require('path');
const { wasm: wasm_tester, wasm } = require('circom_tester');
import { poseidonEncrypt, genRandomNonce } from '../src/poseidon_encryption/index';
import { genKeypair } from 'maci-crypto';

function encryptShot(shot: Array<number>) {
    
    const key = genKeypair().pubKey;
    const nonce = genRandomNonce();
    const encrypted_shot = poseidonEncrypt(
        shot.map((x) => BigInt(x)), 
        key, 
        nonce 
    );
    return {
        encrypted_shot: encrypted_shot.map((x) => x.toString()),
        nonce: nonce.toString(),
        key: key.map((x) => x.toString())
    }
}
// x, y, z (horizontal/ verical orientation) ship placements
const boards = {
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
// wasm path for shot circuit 
const wasm_shot_path = 'circuits/artifacts/setup/shot_js/shot.wasm';
// zkey paths for shot circuit 
const zkey_shot_path = 'circuits/artifacts/setup/zkey/shot_final.zkey';
// vkey paths for board and shot circuit respectively
const vkey_board_path = 'circuits/artifacts/board_verification_key.json';
const vkey_shot_path = 'circuits/artifacts/shot_verification_key.json';
const verificationKeys = {
    board: JSON.parse(fs.readFileSync(vkey_board_path)),
    shot: JSON.parse(fs.readFileSync(vkey_shot_path))
}

// these board samples were reached using the battlezips front end
describe('Test circuits', async () => {

    let poseidon, F
    let boardCircuit, shotCircuit

    before(async () => {
        poseidon = await buildPoseidonOpt() // poseidon hash function using bn128
        F = poseidon.F //bn128 ff lib
        boardCircuit = await wasm_tester(path.resolve('./circuits/board.circom'))
        shotCircuit = await wasm_tester(path.resolve('./circuits/shot.circom'))
    })
    describe('Game Initialization Integrity Proof (board.circom)', async () => {
        describe('Valid Board Proofs', async () => {
            it("Prove valid board 1", async () => {
                const ships = [
                    [0, 0, 0],
                    [0, 1, 0],
                    [0, 2, 0],
                    [0, 3, 0],
                    [0, 4, 0]
                ]
                const hash = await poseidon(ships.flat())
                const witness = await boardCircuit.calculateWitness({
                    ships,
                    hash: F.toObject(hash)
                })
                await boardCircuit.assertOut(witness, {})
            })
            it("Prove valid board 2", async () => {
                const ships = [
                    [9, 0, 1],
                    [9, 5, 1],
                    [7, 9, 0],
                    [6, 8, 0],
                    [7, 7, 0]
                ]
                const hash = await poseidon(ships.flat())
                const witness = await boardCircuit.calculateWitness({
                    ships,
                    hash: F.toObject(hash)
                })
                await boardCircuit.assertOut(witness, {})
            })
            it("Prove valid board 3", async () => {
                const ships = [
                    [0, 1, 1],
                    [4, 3, 0],
                    [3, 3, 1],
                    [5, 9, 0],
                    [1, 8, 1]
                ]
                const hash = await poseidon(ships.flat())
                const witness = await boardCircuit.calculateWitness({
                    ships,
                    hash: F.toObject(hash)
                })
                await boardCircuit.assertOut(witness, {})
            })
        })
        describe('Out of Bound Checks', async () => {
            it("Range violation board 1: negative", async () => {
                const ships = [
                    [-1, 0, 0],
                    [0, 1, 0],
                    [0, 2, 0],
                    [0, 3, 0],
                    [0, 4, 0]
                ]
                const hash = await poseidon(ships.flat())
                try {
                    await boardCircuit.calculateWitness({
                        ships,
                        hash: F.toObject(hash)
                    });
                    assert(false);
                } catch (err) {
                    assert(err.message.includes("Assert Failed"));
                }
            })
            it("Range violation board 2: out of bounds x/ y", async () => {
                const ships = [
                    [0, 0, 0],
                    [0, 10, 0],
                    [0, 2, 0],
                    [0, 3, 0],
                    [0, 4, 0]
                ]
                const hash = await poseidon(ships.flat())
                try {
                    await boardCircuit.calculateWitness({
                        ships,
                        hash: F.toObject(hash)
                    });
                    assert(false);
                } catch (err) {
                    assert(err.message.includes("Assert Failed"));
                }
            })
            it("Range violation board 3: out of bounds z", async () => {
                const ships = [
                    [0, 0, 0],
                    [0, 1, 0],
                    [0, 2, 0],
                    [0, 3, 0],
                    [0, 4, 2]
                ]
                const hash = await poseidon(ships.flat())
                try {
                    await boardCircuit.calculateWitness({
                        ships,
                        hash: F.toObject(hash)
                    });
                    assert(false);
                } catch (err) {
                    assert(err.message.includes("Assert Failed"));
                }
            })
        })
        describe("Collision Checks", async () => {
            it("Placement violation board 1", async () => {
                const ships = [
                    [0, 0, 0],
                    [0, 0, 0],
                    [0, 2, 0],
                    [0, 3, 0],
                    [0, 4, 0]
                ]
                const hash = await poseidon(ships.flat())
                try {
                    await boardCircuit.calculateWitness({
                        ships,
                        hash: F.toObject(hash)
                    });
                    assert(false);
                } catch (err) {
                    assert(err.message.includes("Assert Failed"));
                }
            })
            it("Placement violation board 2", async () => {
                const ships = [
                    [9, 0, 1],
                    [9, 5, 1],
                    [7, 9, 0],
                    [6, 8, 0],
                    [7, 7, 1]
                ]
                const hash = await poseidon(ships.flat())
                try {
                    await boardCircuit.calculateWitness({
                        ships,
                        hash: F.toObject(hash)
                    });
                    assert(false);
                } catch (err) {
                    assert(err.message.includes("Assert Failed"));
                }
            })
            it("Placement violation board 3", async () => {
                const ships = [
                    [0, 1, 1],
                    [4, 3, 0],
                    [3, 3, 0],
                    [5, 9, 0],
                    [1, 8, 1]
                ]
                const hash = await poseidon(ships.flat())
                try {
                    await boardCircuit.calculateWitness({
                        ships,
                        hash: F.toObject(hash)
                    });
                    assert(false);
                } catch (err) {
                    assert(err.message.includes("Assert Failed"));
                }
            })
        })
        describe("Hash Integrity Checks", async () => {
            it("Board hash integrity check", async () => {
                const ships = [
                    [0, 1, 1],
                    [4, 3, 0],
                    [3, 3, 1],
                    [5, 9, 0],
                    [1, 8, 1]
                ]
                const hash = await poseidon(boards.player1.flat())
                try {
                    await boardCircuit.calculateWitness({
                        ships,
                        hash: F.toObject(hash)
                    });
                    assert(false);
                } catch (err) {
                    assert(err.message.includes("Assert Failed"));
                }
            })
        })
    })
    describe('Hitscan Integrity Turn Proof (shot.circom)', async () => {
        describe('Valid Turn Proofs', async () => {
            it("Prove valid turn 1: hit on head", async () => {
                const ships = [
                    [0, 0, 0],
                    [0, 1, 0],
                    [0, 2, 0],
                    [0, 3, 0],
                    [0, 4, 0]
                ]
                const hash = await poseidon(ships.flat())
                const shot = [0, 0]
                const encryption = encryptShot(shot)
                const input_shot = {
                    ships,
                    hash: F.toObject(hash),
                    encrypted_shot: encryption.encrypted_shot,
                    nonce: encryption.nonce,
                    key: encryption.key

                }
                const witness = await shotCircuit.calculateWitness(input_shot)
                await shotCircuit.assertOut(witness, {})
            })
            it("Prove valid turn 2: hit off head on z = 0", async () => {
                const ships = [
                    [1, 2, 0],
                    [2, 8, 0],
                    [5, 4, 0],
                    [5, 6, 0],
                    [8, 0, 0]
                ]
                const hash = await poseidon(ships.flat())
                const shot = [4, 2]
                const encryption = encryptShot(shot)
                const input_shot = {
                    ships,
                    hash: F.toObject(hash),
                    encrypted_shot: encryption.encrypted_shot,
                    nonce: encryption.nonce,
                    key: encryption.key

                }
                const witness = await shotCircuit.calculateWitness(input_shot)
                await shotCircuit.assertOut(witness, {})
            })
            it("Prove valid turn 3: hit off head on z = 1", async () => {
                const ships = [
                    [1, 1, 1],
                    [5, 1, 1],
                    [4, 4, 1],
                    [1, 7, 1],
                    [3, 8, 0]
                ]
                const hash = await poseidon(ships.flat())
                const shot = [4, 5]
                const encryption = encryptShot(shot)
                const input_shot = {
                    ships,
                    hash: F.toObject(hash),
                    encrypted_shot: encryption.encrypted_shot,
                    nonce: encryption.nonce,
                    key: encryption.key

                }
                const witness = await shotCircuit.calculateWitness(input_shot)
                await shotCircuit.assertOut(witness, {})
            })
            it("Prove valid turn 4: miss with no collision", async () => {
                const ships = [
                    [0, 0, 0],
                    [0, 1, 0],
                    [0, 2, 0],
                    [0, 3, 0],
                    [0, 4, 0]
                ]
                const hash = await poseidon(ships.flat())
                const shot = [9, 5]
                const encryption = encryptShot(shot)
                const input_shot = {
                    ships,
                    hash: F.toObject(hash),
                    encrypted_shot: encryption.encrypted_shot,
                    nonce: encryption.nonce,
                    key: encryption.key

                }
                const witness = await shotCircuit.calculateWitness(input_shot)
                await shotCircuit.assertOut(witness, {})
            })
            it("Prove valid turn 5: horizontal muxxed miss with vertical hit", async () => {
                // demonstrate miss computation even if z=1 collision when z = 0
                const ships = [
                    [1, 1, 1],
                    [5, 1, 1],
                    [4, 4, 1],
                    [1, 7, 1],
                    [3, 8, 0]
                ]
                const hash = await poseidon(ships.flat())
                const shot = [2, 1]
                const encryption = encryptShot(shot)
                const input_shot = {
                    ships,
                    hash: F.toObject(hash),
                    encrypted_shot: encryption.encrypted_shot,
                    nonce: encryption.nonce,
                    key: encryption.key

                }
                const witness = await shotCircuit.calculateWitness(input_shot)
                await shotCircuit.assertOut(witness, {})
            })
            it("Prove valid turn 6: vertical muxxed miss with horizontal hit", async () => {
                // demonstrate miss computation even if z=0 collision when z = 1
                const ships = [
                    [1, 2, 0],
                    [2, 8, 0],
                    [5, 4, 0],
                    [5, 6, 0],
                    [8, 0, 0]
                ]
                const hash = await poseidon(ships.flat())
                const shot = [1, 3]
                const encryption = encryptShot(shot)
                const input_shot = {
                    ships,
                    hash: F.toObject(hash),
                    encrypted_shot: encryption.encrypted_shot,
                    nonce: encryption.nonce,
                    key: encryption.key

                }
                const witness = await shotCircuit.calculateWitness(input_shot)
                await shotCircuit.assertOut(witness, { })
            })
        })
        describe('Out of Bound Shot Checks', async () => {
            it("Shot range violation turn 1: negative", async () => {
                const ships = [
                    [0, 0, 0],
                    [0, 1, 0],
                    [0, 2, 0],
                    [0, 3, 0],
                    [0, 4, 0]
                ]
                const hash = await poseidon(ships.flat())
                const shot = [-1, 3]
                
                try {
                    const encryption = encryptShot(shot)
                    const input_shot = {
                    ships,
                    hash: F.toObject(hash),
                    encrypted_shot: encryption.encrypted_shot,
                    nonce: encryption.nonce,
                    key: encryption.key

                }
                const witness = await shotCircuit.calculateWitness({
                    input_shot
                })
                    let expected = Error;
                    assert.throws(witness, expected);
                } catch (err) {}
            })
            it("Shot range violation turn 2: x out of bounds", async () => {
                const ships = [
                    [0, 0, 0],
                    [0, 1, 0],
                    [0, 2, 0],
                    [0, 3, 0],
                    [0, 4, 0]
                ]
                const hash = await poseidon(ships.flat())
                const shot = [10, 3]
                
                const encryption = encryptShot(shot)
                const input_shot = {
                    ships,
                    hash: F.toObject(hash),
                    encrypted_shot: encryption.encrypted_shot,
                    nonce: encryption.nonce,
                    key: encryption.key

                }
                
                try {
                    await shotCircuit.calculateWitness(input_shot)
                    assert(false);
                } catch (err) {
                    assert(err.message.includes("Assert Failed"));
                }
            })
            it("Shot range violation turn 3: y out of bounds", async () => {
                const ships = [
                    [0, 0, 0],
                    [0, 1, 0],
                    [0, 2, 0],
                    [0, 3, 0],
                    [0, 4, 0]
                ]
                const hash = await poseidon(ships.flat())
                const shot = [0, 13]
                
                const encryption = encryptShot(shot)
                const input_shot = {
                    ships,
                    hash: F.toObject(hash),
                    encrypted_shot: encryption.encrypted_shot,
                    nonce: encryption.nonce,
                    key: encryption.key

                }
                
                try {
                    await shotCircuit.calculateWitness(input_shot)
                    assert(false);
                } catch (err) {
                    assert(err.message.includes("Assert Failed"));
                }
            })
        })
        describe("False hit assertion", async () => {
            it("Tampered Hit output assertion violation turn 1: head hit but report miss", async () => {
                const ships = [
                    [0, 0, 0],
                    [0, 1, 0],
                    [0, 2, 0],
                    [0, 3, 0],
                    [0, 4, 0]
                ]
                const hash = await poseidon(ships.flat())
                const shot = [0, 0]
                
                // prepare shot circuit input
                const encryption = encryptShot(shot)
                const input_shot = {
                    ships,
                    hash: F.toObject(hash),
                    encrypted_shot: encryption.encrypted_shot,
                    nonce: encryption.nonce,
                    key: encryption.key

                }
                
                // compute witness and run through groth16 circuit for proof / signals
                const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                    input_shot,
                    wasm_shot_path,
                    zkey_shot_path
                )
                // alter with the successful hit to miss
                const false_publicSignals = [
                    '0',
                    F.toObject(hash).toString(), 
                    shot[0].toString(), 
                    shot[1].toString()     
                ];
        
                // verify proof with altered hit as missed
                const verify_shot = await snarkjs.groth16.verify(
                    verificationKeys.shot, 
                    false_publicSignals, 
                    proof
                )
                expect(publicSignals[0]).to.be.equals('1');
                expect(verify_shot).to.be.false;
                
            })
            it("Tampered Hit output assertion violation turn 2: head miss but report hit", async () => {
                const ships = [
                    [0, 0, 0],
                    [0, 1, 0],
                    [0, 2, 0],
                    [0, 3, 0],
                    [0, 4, 0]
                ]
                const hash = await poseidon(ships.flat())
                const shot = [6, 6]
                
                // prepare shot circuit input
                const encryption = encryptShot(shot)
                const input_shot = {
                    ships,
                    hash: F.toObject(hash),
                    encrypted_shot: encryption.encrypted_shot,
                    nonce: encryption.nonce,
                    key: encryption.key

                }
                
                // compute witness and run through groth16 circuit for proof / signals
                const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                    input_shot,
                    wasm_shot_path,
                    zkey_shot_path
                )
                // alter with missed shot to hit
                const false_publicSignals = [
                    '1',
                    F.toObject(hash).toString(), 
                    shot[0].toString(), 
                    shot[1].toString()     
                ];
        
                // verify proof with altered miss as hit
                const verify_shot = await snarkjs.groth16.verify(
                    verificationKeys.shot, 
                    false_publicSignals, 
                    proof
                )
                expect(publicSignals[0]).to.be.equals('0');
                expect(verify_shot).to.be.false;
            })
            it("Tampered Hit output assertion violation turn 3: z=0 hit but report miss", async () => {
                const ships = [
                    [1, 2, 0],
                    [2, 8, 0],
                    [5, 4, 0],
                    [5, 6, 0],
                    [8, 0, 0]
                ]
                const hash = await poseidon(ships.flat())
                const shot = [3, 2]
                
                // prepare shot circuit input
                const encryption = encryptShot(shot)
                const input_shot = {
                    ships,
                    hash: F.toObject(hash),
                    encrypted_shot: encryption.encrypted_shot,
                    nonce: encryption.nonce,
                    key: encryption.key

                }
                
                // compute witness and run through groth16 circuit for proof / signals
                const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                    input_shot,
                    wasm_shot_path,
                    zkey_shot_path
                )
                // alter with the successful hit to miss 
                const false_publicSignals = [
                    '0',
                    F.toObject(hash).toString(), 
                    shot[0].toString(), 
                    shot[1].toString()     
                ];
        
                // verify proof with altered hit as missed
                const verify_shot = await snarkjs.groth16.verify(
                    verificationKeys.shot, 
                    false_publicSignals, 
                    proof
                )
                expect(publicSignals[0]).to.be.equals('1');
                expect(verify_shot).to.be.false;
            })
            it("Tampered Hit output assertion violation turn 4: z=0 miss but report hit", async () => {
                const ships = [
                    [1, 1, 1],
                    [5, 1, 1],
                    [4, 4, 1],
                    [1, 7, 1],
                    [3, 8, 0]
                ]
                const hash = await poseidon(ships.flat())
                const shot = [2, 1]
                
                // prepare shot circuit input
                const encryption = encryptShot(shot)
                const input_shot = {
                    ships,
                    hash: F.toObject(hash),
                    encrypted_shot: encryption.encrypted_shot,
                    nonce: encryption.nonce,
                    key: encryption.key

                }
                
                // compute witness and run through groth16 circuit for proof / signals
                const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                    input_shot,
                    wasm_shot_path,
                    zkey_shot_path
                )
                // alter with missed shot to hit
                const false_publicSignals = [
                    '1',
                    F.toObject(hash).toString(), 
                    shot[0].toString(), 
                    shot[1].toString()     
                ];
        
                // verify proof with altered miss as hit
                const verify_shot = await snarkjs.groth16.verify(
                    verificationKeys.shot, 
                    false_publicSignals, 
                    proof
                )
                expect(publicSignals[0]).to.be.equals('0');
                expect(verify_shot).to.be.false;
            })
            it("Tampered Hit output assertion violation turn 5: z=1 hit but report miss", async () => {
                const ships = [
                    [1, 1, 1],
                    [5, 1, 1],
                    [4, 4, 1],
                    [1, 7, 1],
                    [3, 8, 0]
                ]
                const hash = await poseidon(ships.flat())
                const shot = [1, 3]
                
                // prepare shot circuit input
                const encryption = encryptShot(shot)
                const input_shot = {
                    ships,
                    hash: F.toObject(hash),
                    encrypted_shot: encryption.encrypted_shot,
                    nonce: encryption.nonce,
                    key: encryption.key

                }
                
                // compute witness and run through groth16 circuit for proof / signals
                const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                    input_shot,
                    wasm_shot_path,
                    zkey_shot_path
                )
                // alter with the successful hit to miss 
                const false_publicSignals = [
                    '0',
                    F.toObject(hash).toString(), 
                    shot[0].toString(), 
                    shot[1].toString()     
                ];
        
                // verify proof with altered hit as missed
                const verify_shot = await snarkjs.groth16.verify(
                    verificationKeys.shot, 
                    false_publicSignals, 
                    proof
                )
                expect(publicSignals[0]).to.be.equals('1');
                expect(verify_shot).to.be.false;
            })
            it("Tampered Hit output assertion violation turn 6: z=1 miss but report hit", async () => {
                const ships = [
                    [1, 2, 0],
                    [2, 8, 0],
                    [5, 4, 0],
                    [5, 6, 0],
                    [8, 0, 0]
                ]
                const hash = await poseidon(ships.flat())
                const shot = [1, 3]
                
                // prepare shot circuit input
                const encryption = encryptShot(shot)
                const input_shot = {
                    ships,
                    hash: F.toObject(hash),
                    encrypted_shot: encryption.encrypted_shot,
                    nonce: encryption.nonce,
                    key: encryption.key

                }
                
                // compute witness and run through groth16 circuit for proof / signals
                const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                    input_shot,
                    wasm_shot_path,
                    zkey_shot_path
                )
                // alter with missed shot to hit
                const false_publicSignals = [
                    '1',
                    F.toObject(hash).toString(), 
                    shot[0].toString(), 
                    shot[1].toString()     
                ];
        
                // verify proof with altered miss as hit
                const verify_shot = await snarkjs.groth16.verify(
                    verificationKeys.shot, 
                    false_publicSignals, 
                    proof
                )
                expect(publicSignals[0]).to.be.equals('0');
                expect(verify_shot).to.be.false;
            })
        })
        describe("Hash Integrity Checks", async () => {
            it("Hash integrity violation check", async () => {
                const ships = [
                    [0, 0, 0],
                    [0, 1, 0],
                    [0, 2, 0],
                    [0, 3, 0],
                    [5, 5, 0]
                ]
                const hash = await poseidon(boards.player1.flat())
                const shot = [0, 0]
                const encryption = encryptShot(shot)
                const input_shot = {
                    ships,
                    hash: F.toObject(hash),
                    encrypted_shot: encryption.encrypted_shot,
                    nonce: encryption.nonce,
                    key: encryption.key

                }
                
                try {
                    await shotCircuit.calculateWitness(input_shot)
                    assert(false);
                } catch (err) {
                    assert(err.message.includes("Assert Failed"));
                }
            })
        })
    })
})
