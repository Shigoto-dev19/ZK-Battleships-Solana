const { assert } = require("chai");
const { boards, shots, verificationKeys, buildProofArgs } = require('../src/utils')
const path = require('path')
const { wasm: wasm_tester, wasm } = require('circom_tester')
const { buildMimcSponge } = require('circomlibjs')

// these board samples were reached using the battlezips front end
describe('Test circuits', async () => {

    let mimcSponge, F
    let boardCircuit, shotCircuit

    before(async () => {
        mimcSponge = await buildMimcSponge() // mimcSponge hash function using bn128
        F = mimcSponge.F //bn128 ff lib
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
                const hash = await mimcSponge.multiHash(ships.flat())
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
                const hash = await mimcSponge.multiHash(ships.flat())
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
                const hash = await mimcSponge.multiHash(ships.flat())
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
                const hash = await mimcSponge.multiHash(ships.flat())
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
                const hash = await mimcSponge.multiHash(ships.flat())
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
                const hash = await mimcSponge.multiHash(ships.flat())
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
                const hash = await mimcSponge.multiHash(ships.flat())
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
                const hash = await mimcSponge.multiHash(ships.flat())
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
                const hash = await mimcSponge.multiHash(ships.flat())
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
                const hash = await mimcSponge.multiHash(boards.player1.flat())
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
                const hash = await mimcSponge.multiHash(ships.flat())
                const shot = [0, 0]
                const hit = 1
                const witness = await shotCircuit.calculateWitness({
                    ships,
                    hash: F.toObject(hash),
                    shot,
                    hit
                })
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
                const hash = await mimcSponge.multiHash(ships.flat())
                const shot = [4, 2]
                const hit = 1
                const witness = await shotCircuit.calculateWitness({
                    ships,
                    hash: F.toObject(hash),
                    shot,
                    hit
                })
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
                const hash = await mimcSponge.multiHash(ships.flat())
                const shot = [4, 5]
                const hit = 1
                const witness = await shotCircuit.calculateWitness({
                    ships,
                    hash: F.toObject(hash),
                    shot,
                    hit
                })
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
                const hash = await mimcSponge.multiHash(ships.flat())
                const shot = [9, 5]
                const hit = 0
                const witness = await shotCircuit.calculateWitness({
                    ships,
                    hash: F.toObject(hash),
                    shot,
                    hit
                })
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
                const hash = await mimcSponge.multiHash(ships.flat())
                const shot = [2, 1]
                const hit = 0
                const witness = await shotCircuit.calculateWitness({
                    ships,
                    hash: F.toObject(hash),
                    shot,
                    hit
                })
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
                const hash = await mimcSponge.multiHash(ships.flat())
                const shot = [1, 3]
                const hit = 0
                const witness = await shotCircuit.calculateWitness({
                    ships,
                    hash: F.toObject(hash),
                    shot,
                    hit
                })
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
                const hash = await mimcSponge.multiHash(ships.flat())
                const shot = [-1, 3]
                const hit = 0
                try {
                    const exercise = await shotCircuit.calculateWitness({
                        ships,
                        hash: F.toObject(hash),
                        shot,
                        hit
                    });
                    let expected = Error;
                    assert.throws(exercise, expected);
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
                const hash = await mimcSponge.multiHash(ships.flat())
                const shot = [10, 3]
                const hit = 0
                try {
                    await shotCircuit.calculateWitness({
                        ships,
                        hash: F.toObject(hash),
                        shot,
                        hit
                    });
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
                const hash = await mimcSponge.multiHash(ships.flat())
                const shot = [0, 13]
                const hit = 0
                try {
                    await shotCircuit.calculateWitness({
                        ships,
                        hash: F.toObject(hash),
                        shot,
                        hit
                    });
                    assert(false);
                } catch (err) {
                    assert(err.message.includes("Assert Failed"));
                }
            })
        })
        describe("False hit assertion", async () => {
            it("Hit assertion violation turn 1: head hit but report miss", async () => {
                const ships = [
                    [0, 0, 0],
                    [0, 1, 0],
                    [0, 2, 0],
                    [0, 3, 0],
                    [0, 4, 0]
                ]
                const hash = await mimcSponge.multiHash(ships.flat())
                const shot = [0, 0]
                const hit = 0
                try {
                    await shotCircuit.calculateWitness({
                        ships,
                        hash: F.toObject(hash),
                        shot,
                        hit
                    });
                    assert(false);
                } catch (err) {
                    assert(err.message.includes("Assert Failed"));
                }
            })
            it("Hit assertion violation turn 2: head miss but report hit", async () => {
                const ships = [
                    [0, 0, 0],
                    [0, 1, 0],
                    [0, 2, 0],
                    [0, 3, 0],
                    [0, 4, 0]
                ]
                const hash = await mimcSponge.multiHash(ships.flat())
                const shot = [6, 6]
                const hit = 1
                try {
                    await shotCircuit.calculateWitness({
                        ships,
                        hash: F.toObject(hash),
                        shot,
                        hit
                    });
                    assert(false);
                } catch (err) {
                    assert(err.message.includes("Assert Failed"));
                }
            })
            it("Hit assertion violation turn 3: z=0 hit but report miss", async () => {
                const ships = [
                    [1, 2, 0],
                    [2, 8, 0],
                    [5, 4, 0],
                    [5, 6, 0],
                    [8, 0, 0]
                ]
                const hash = await mimcSponge.multiHash(ships.flat())
                const shot = [3, 2]
                const hit = 0
                try {
                    await shotCircuit.calculateWitness({
                        ships,
                        hash: F.toObject(hash),
                        shot,
                        hit
                    });
                    assert(false);
                } catch (err) {
                    assert(err.message.includes("Assert Failed"));
                }
            })
            it("Hit assertion violation turn 4: z=0 miss but report hit", async () => {
                const ships = [
                    [1, 1, 1],
                    [5, 1, 1],
                    [4, 4, 1],
                    [1, 7, 1],
                    [3, 8, 0]
                ]
                const hash = await mimcSponge.multiHash(ships.flat())
                const shot = [2, 1]
                const hit = 1
                try {
                    await shotCircuit.calculateWitness({
                        ships,
                        hash: F.toObject(hash),
                        shot,
                        hit
                    });
                    assert(false);
                } catch (err) {
                    assert(err.message.includes("Assert Failed"));
                }
            })
            it("Hit assertion violation turn 5: z=1 hit but report miss", async () => {
                const ships = [
                    [1, 1, 1],
                    [5, 1, 1],
                    [4, 4, 1],
                    [1, 7, 1],
                    [3, 8, 0]
                ]
                const hash = await mimcSponge.multiHash(ships.flat())
                const shot = [1, 3]
                const hit = 0
                try {
                    await shotCircuit.calculateWitness({
                        ships,
                        hash: F.toObject(hash),
                        shot,
                        hit
                    });
                    assert(false);
                } catch (err) {
                    assert(err.message.includes("Assert Failed"));
                }
            })
            it("Hit assertion violation turn 6: z=1 miss but report hit", async () => {
                const ships = [
                    [1, 2, 0],
                    [2, 8, 0],
                    [5, 4, 0],
                    [5, 6, 0],
                    [8, 0, 0]
                ]
                const hash = await mimcSponge.multiHash(ships.flat())
                const shot = [1, 3]
                const hit = 1
                try {
                    await shotCircuit.calculateWitness({
                        ships,
                        hash: F.toObject(hash),
                        shot,
                        hit
                    });
                    assert(false);
                } catch (err) {
                    assert(err.message.includes("Assert Failed"));
                }
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
                const hash = await mimcSponge.multiHash(boards.player1.flat())
                const shot = [0, 0]
                const hit = 0
                try {
                    await shotCircuit.calculateWitness({
                        ships,
                        hash: F.toObject(hash),
                        shot,
                        hit
                    });
                    assert(false);
                } catch (err) {
                    assert(err.message.includes("Assert Failed"));
                }
            })
        })
    })
})
