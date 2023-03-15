pragma circom 2.0.3;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";
include "../../node_modules/circomlib/circuits/escalarmulany.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";


template PoseidonDecrypt(l) {

    var decryptedLength = l;
    while (decryptedLength % 3 != 0) {
        decryptedLength += 1;
    }
    // e.g. if l == 4, decryptedLength == 6

    signal input ciphertext[decryptedLength + 1];
    signal input nonce;
    signal input key[2];
    signal output decrypted[decryptedLength];

    var two128 = 2 ** 128;

    // The nonce must be less than 2 ^ 128
    component lt = LessThan(252);
    lt.in[0] <== nonce;
    lt.in[1] <== two128;
    lt.out === 1;

    var n = (decryptedLength + 1) \ 3;

    component strategies[n + 1];
    // Iterate Poseidon on the initial state
    
    strategies[0] = PoseidonEx(3, 4);
    strategies[0].initialState <== 0;
    strategies[0].inputs[0] <== key[0];
    strategies[0].inputs[1] <== key[1];
    strategies[0].inputs[2] <== nonce + (l * two128);

    for (var i = 0; i < n; i ++) {
        
        // Release three elements of the message
        for (var j = 0; j < 3; j ++) {
            decrypted[i * 3 + j] <== ciphertext[i * 3 + j] - strategies[i].out[j + 1];
        }

        // Iterate Poseidon on the state
        strategies[i + 1] = PoseidonEx(3, 4);
        strategies[i + 1].initialState <== strategies[i].out[0];
        for (var j = 0; j < 3; j ++) {
            strategies[i + 1].inputs[j] <== ciphertext[i * 3 + j];
        }
    }

    // Check the last ciphertext element
    ciphertext[decryptedLength] === strategies[n].out[1];

    // If length > 3, check if the last (3 - (l mod 3)) elements of the message
    // are 0
    if (l % 3 > 0) {
        if (l % 3 == 2) {
            decrypted[decryptedLength - 1] === 0;
        } else if (l % 3 == 2) {
            decrypted[decryptedLength - 1] === 0;
            decrypted[decryptedLength - 2] === 0;
        }
    }
}

template Ecdh() {
    // Note: The private key needs to be hashed and then pruned first
    signal input privKey;
    signal input pubKey[2];

    signal output sharedKey[2];

    component privBits = Num2Bits(253);
    privBits.in <== privKey;

    component mulFix = EscalarMulAny(253);
    mulFix.p[0] <== pubKey[0];
    mulFix.p[1] <== pubKey[1];

    for (var i = 0; i < 253; i++) {
        mulFix.e[i] <== privBits.out[i];
    }

    sharedKey[0] <== mulFix.out[0];
    sharedKey[1] <== mulFix.out[1];
} 
