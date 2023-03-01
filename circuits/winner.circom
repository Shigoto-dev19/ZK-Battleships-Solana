pragma circom 2.0.3;

include "./templates/poseidonDecrypt.circom";

/*
    determine whether a player has won or not
*/

template Winner() {

    signal input encrypted_hit_count[4];  // poseidon encrypted hit count
    signal input nonce;                   // we choose the nonce as the turn count
    signal input key[2];                  // the ecdh shared key
    signal output out;                    // 1 if hit_count= 17 else 0

    signal pOut[3];                       // the output of poseidon decryption
    signal hit_count;                     // poseidon decrypted hit count

    /// POSEIDON DECRYPT HIT COUNT  ///
    component pDecrypt = PoseidonDecrypt(1);
    pDecrypt.ciphertext <== encrypted_hit_count;
    pDecrypt.nonce <== nonce;
    pDecrypt.key <== key;
    pDecrypt.decrypted ==> pOut;
    hit_count <== pOut[0];

    // Assert hit count is 17 to decide the winner
    component isE = IsEqual();
    isE.in[0] <== hit_count;
    isE.in[1] <== 17;
    out <== isE.out;

}

component main { public [encrypted_hit_count, nonce] } = Winner();