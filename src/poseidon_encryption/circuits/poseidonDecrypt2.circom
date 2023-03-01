pragma circom 2.1.2;

include "../../../circuits/templates/poseidonDecrypt.circom";

component main { public [ciphertext, nonce] } = PoseidonDecrypt(2);