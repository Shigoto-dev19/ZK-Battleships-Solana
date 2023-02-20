import { GameSimulation } from "./gameSimulation";

const fs = require('fs');
const snarkjs = require('snarkjs');
const { buildMimcSponge } = require("circomlibjs");


// verification key json files
const verificationKeys = {
    board: JSON.parse(fs.readFileSync('circuits/artifacts/board_verification_key.json')),
    shot: JSON.parse(fs.readFileSync('circuits/artifacts/shot_verification_key.json'))
}

const wasm_path = {
    board: 'circuits/artifacts/setup/board_js/board.wasm',
    shot: 'circuits/artifacts/setup/shot_js/shot.wasm'
}

const zkey_path = {
    board: 'circuits/artifacts/setup/zkey/board_final.zkey',
    shot: 'circuits/artifacts/setup/zkey/shot_final.zkey'
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

// shots alice to hit / bob to miss
const shots = {
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

// getProof function to avoid block-redeclaration errors
async function getProof(input, wasm, zkey_path) {                                                                                                    

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasm, zkey_path);
    return proof;
}

/**
 * Initialize new environment for interacting with ZK-Battleship game contracts
 * 
 * @returns {Object} :
 *  - game: ZK-Battleship game simulation object
 *  - mimcSponge: initialized MiMC Sponge ZK-Friendly hash function object from circomlibjs
 *  - boardHashes: hashed versions of alice/ bob boards
 *  - F: initialized ffjavascript BN254 curve object derived from mimcSponge
 */
async function initialize() {
    
    // instantiate a gameSimulation
    const game = new GameSimulation();
    // instantiate mimc sponge on bn254 curve + store ffjavascript obj reference
    const mimcSponge = await buildMimcSponge()
    // store board hashes for quick use
    const boardHashes = {
        player1: await mimcSponge.multiHash(boards.player1.flat()),
        player2: await mimcSponge.multiHash(boards.player2.flat())
    }
    return { game, mimcSponge, boardHashes, F: mimcSponge.F }
}

// inline ephemeral logging
function printLog(msg) {
    if (process.stdout.isTTY) {
        process.stdout.clearLine(-1);
        process.stdout.cursorTo(0);
        process.stdout.write(msg);
    }
}

export { 
    verificationKeys,
    wasm_path, 
    zkey_path,
    boards,
    shots, 
    snarkjs,
    buildMimcSponge,
    printLog,
    initialize,
    getProof
};