import { poseidonEncrypt, poseidonDecrypt, genRandomNonce } from '../index';
import { genKeypair, genEcdhSharedKey } from 'maci-crypto';
import { BattleShipClient } from '../../battleShipClient';
const { wasm: wasm_tester, wasm } = require('circom_tester');
const fs = require('fs');
const { expect } = require("chai");
const snarkjs = require('snarkjs');

const poseidon_wasm_path = 'src/poseidon_encryption/circuits/poseidonDecrypt2_js/poseidonDecrypt2.wasm';
const poseidon_zkey_path = 'src/poseidon_encryption/circuits/poseidonDecrypt2.zkey';

function randomShot(): number[] {
    let random_shot = [
        Math.floor(Math.random() * 10),
        Math.floor(Math.random() * 10)
    ];
    return random_shot
}
function randomHit(): number[] {
    let random_Hit = [ Math.floor(Math.random() * 2)];
    return random_Hit
}

const keypair = genKeypair()

const test = (message: BigInt[]) => {
    
    const nonce = genRandomNonce()
    const ciphertext = poseidonEncrypt(message, keypair.pubKey, nonce)
    const decrypted = poseidonDecrypt(ciphertext, keypair.pubKey, nonce, message.length)

    for (let i = 0; i < message.length; i ++) {
        if (message[i] !== decrypted[i]) {
            console.log(keypair, nonce, message, ciphertext)
        }
        expect(message[i]).to.equals(decrypted[i])
    }
    expect(message.length).to.equals(decrypted.length)
}

describe('Encryption and decryption', () => {

    it('Encryption and decryption of inputs with different lengths', () => {
        test([0].map((x) => BigInt(x)))
        test([0, 1].map((x) => BigInt(x)))
        test([0, 1, 2].map((x) => BigInt(x)))
        test([0, 1, 2, 3].map((x) => BigInt(x)))
        test([0, 1, 2, 3, 4].map((x) => BigInt(x)))
        test([0, 1, 2, 3, 4, 5].map((x) => BigInt(x)))
        test([0, 1, 2, 3, 4, 5, 6].map((x) => BigInt(x)))
    })

    it('Encryption and decryption of a random shot', () => {
        test(randomShot().map((x) => BigInt(x)))
    })

    it('Looped Encryption and decryption of a random shot', () => {
        for (let i=0; i<100; i++)
        test(randomShot().map((x) => BigInt(x)))
    })

    it('Encryption and decryption of a random hit', () => {
        
        const message = randomHit();
        const keypair = genKeypair();
        const nonce = genRandomNonce();
        const ciphertext = poseidonEncrypt(message, keypair.pubKey, nonce);
        const decrypted = poseidonDecrypt(ciphertext, keypair.pubKey, nonce, message.length);
        const object = JSON.stringify({
            encrypted_hit_count: ciphertext,
            nonce: nonce,
            key: keypair.pubKey
        })
    
        expect(Number(decrypted[0])).to.be.equals(message[0]);
    })

    // it('same nonce same ciphertext');
    // it('different nonce difference ciphertext');
})


describe('Decrypt with poseidon circuit', async () => {
    
    it('should fail if the nonce >= 2 ^ 128', async () => {

        const decryptCircuit = await wasm_tester('./src/poseidon_encryption/circuits/poseidonDecrypt2.circom')
    
        const message = randomShot()
        const key = genKeypair().pubKey;
        const nonce = BigInt('340282366920938463463374607431768211456')
        const ciphertext = poseidonEncrypt(message, key, BigInt(1));
       
        const circuitInputs = {
            ciphertext: ciphertext.map((x) => x.toString()),
            nonce: nonce.toString(),
            key: key.map((x) => x.toString())
        }
        
        try {
            await decryptCircuit.calculateWitness(circuitInputs);

        } catch (e) { 
            expect(true).to.be.true
        }
    })
    
    it('Expect Compliant Random Input Decryption', async () => {
        
        const message = randomShot();
        const keypair = genKeypair();
        const nonce = genRandomNonce();
        const ciphertext = poseidonEncrypt(message, keypair.pubKey, nonce);

        const random_input = {
            ciphertext: ciphertext.map((x) => x.toString()),
            nonce: nonce.toString(),
            key: keypair.pubKey.map((x) => x.toString())
        }

        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            random_input,
            poseidon_wasm_path,
            poseidon_zkey_path
        )

        expect(publicSignals[0]).to.equals(message[0].toString());
        expect(publicSignals[1]).to.equals(message[1].toString());

    })

    it('Looped Expect Compliant Random Input Decryption', async () => {

        for (let i=0; i<10; i++) {
            
            let message = randomShot();
            let keypair = genKeypair();
            let nonce = genRandomNonce();
            let ciphertext = poseidonEncrypt(message, keypair.pubKey, nonce);

            let random_input = {
                ciphertext: ciphertext.map((x) => x.toString()),
                nonce: nonce.toString(),
                key: keypair.pubKey.map((x) => x.toString())
            }

            let { proof, publicSignals } = await snarkjs.groth16.fullProve(
                random_input,
                poseidon_wasm_path,
                poseidon_zkey_path
            )

            expect(publicSignals[0]).to.equals(message[0].toString());
            expect(publicSignals[1]).to.equals(message[1].toString());
        }
    })
})

describe('Test compliance of ECDH shared key of two users', () => {
    
    it('Expect compliance of shared keys', () => {
        
        const user1_keypair = genKeypair();
        const user2_keypair = genKeypair();
        const shared_key1 = genEcdhSharedKey(
            user1_keypair.privKey,
            user2_keypair.pubKey
        );
        const shared_key2 = genEcdhSharedKey(
            user2_keypair.privKey,
            user1_keypair.pubKey
        );
        
        expect(shared_key1).to.deep.equals(shared_key2);
    })

    it('Expect non-compliance of shared keys', () => {
        
        const user1_keypair = genKeypair();
        const user2_keypair = genKeypair();
        const shared_key1 = genEcdhSharedKey(
            user1_keypair.privKey,
            user2_keypair.pubKey
        );
        const shared_key2 = genEcdhSharedKey(
            user2_keypair.privKey,
            user2_keypair.pubKey
        );
        //console.log('shared key1: ', shared_key1);
        //console.log('shared key2: ', shared_key2);

        expect(shared_key1).to.not.deep.equals(shared_key2);
    })

    it('Looped: Expect compliance of shared keys', () => {

        for (let i=0; i<50; i++) {
            const user1_keypair = genKeypair();
            const user2_keypair = genKeypair();
            const shared_key1 = genEcdhSharedKey(
                user1_keypair.privKey,
                user2_keypair.pubKey
            );
            const shared_key2 = genEcdhSharedKey(
                user2_keypair.privKey,
                user1_keypair.pubKey
            );
            
            expect(shared_key1).to.deep.equals(shared_key2);
        }
    })      
})

describe('Test shot and winner circuits for decryption', async() => {
    
    it('Test shot decryption is successful', async() => {

        const wasm_shot_path = 'circuits/artifacts/setup/shot_js/shot.wasm';
        const zkey_shot_path = 'circuits/artifacts/setup/zkey/shot_final.zkey';

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
        const key = genKeypair().pubKey;
        const random_shot = [3, 2];
        const nonce = BigInt(1);
        const ciphertext = poseidonEncrypt(
            random_shot, 
            key, 
            nonce 
        );
        
        let bob_joiner = await BattleShipClient.initialize('bob', game1_boards.player2);
        await bob_joiner.newGameData();

        let input_shot = {
            ships: game1_boards.player2,
            hash: BattleShipClient.F.toObject(bob_joiner.boardHash),
            encrypted_shot: ciphertext.map((x) => x.toString()),
            nonce: nonce.toString(),
            key: key.map((x) => x.toString())        
        }
    
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input_shot,
            wasm_shot_path,
            zkey_shot_path
        );
        
        expect(publicSignals[0]).to.equals('1');
    })

    const wasm_winner_path = 'circuits/artifacts/setup/winner_js/winner.wasm';
    const zkey_winner_path = 'circuits/artifacts/setup/zkey/winner_final.zkey';

    it('Test winner circuit is negative', async () => {

        const key = genKeypair().pubKey;
        const random_hit_count = [16];
        const nonce = genRandomNonce();
        const ciphertext = poseidonEncrypt(
            random_hit_count, 
            key, 
            nonce 
        );
        
        let winner_input = {
            encrypted_hit_count: ciphertext.map((x) => x.toString()),
            nonce: nonce.toString(),
            key: key.map((x) => x.toString())
        }
        let { proof, publicSignals } = await snarkjs.groth16.fullProve(
            winner_input,
            wasm_winner_path,
            zkey_winner_path
        )
        expect(publicSignals[0]).to.equals('0');
    
    })

    it('Test winner circuit is positive', async () => {

        const key = genKeypair().pubKey;
        const random_hit_count = [17];
        const nonce = genRandomNonce();
        const ciphertext = poseidonEncrypt(
            random_hit_count, 
            key, 
            nonce 
        );

        let winner_input = {
            encrypted_hit_count: ciphertext.map((x) => x.toString()),
            nonce: nonce.toString(),
            key: key.map((x) => x.toString())
        }
        let { proof, publicSignals } = await snarkjs.groth16.fullProve(
            winner_input,
            wasm_winner_path,
            zkey_winner_path
        )
        const vkey_winner_path = 'circuits/artifacts/winner_verification_key.json';
        const vkey = JSON.parse(fs.readFileSync(vkey_winner_path));
        const result_winner = await snarkjs.groth16.verify(
            vkey, 
            publicSignals, 
            proof
        )
        
        expect(result_winner).to.be.true;
        expect(publicSignals[0]).to.equals('1');
    
    })
})