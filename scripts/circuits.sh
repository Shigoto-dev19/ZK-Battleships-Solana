#!/bin/sh
set -e

# --------------------------------------------------------------------------------
# Phase 2
# ... circuit-specific stuff

# if artifacts/setup does not exist, make folder
[ -d ./circuits/artifacts/setup ] || mkdir ./circuits/artifacts/setup
# if setup/zkey does not exist, make folder
[ -d ./circuits/artifacts/setup/zkey ] || mkdir ./circuits/artifacts/setup/zkey

# Compile circuits
circom ./circuits/board.circom -o ./circuits/artifacts/setup --r1cs --wasm
circom ./circuits/shot.circom -o ./circuits/artifacts/setup --r1cs --wasm

#Setup
yarn snarkjs groth16 setup ./circuits/artifacts/setup/board.r1cs ./circuits/artifacts/ptau/pot15_final.ptau ./circuits/artifacts/setup/board_final.zkey
yarn snarkjs groth16 setup ./circuits/artifacts/setup/shot.r1cs ./circuits/artifacts/ptau/pot15_final.ptau ./circuits/artifacts/setup/shot_final.zkey

# # Generate reference zkey
yarn snarkjs zkey new ./circuits/artifacts/setup/board.r1cs ./circuits/artifacts/ptau/pot15_final.ptau ./circuits/artifacts/setup/board_0000.zkey
yarn snarkjs zkey new ./circuits/artifacts/setup/shot.r1cs ./circuits/artifacts/ptau/pot15_final.ptau ./circuits/artifacts/setup/shot_0000.zkey

# # Ceremony just like before but for zkey this time
yarn snarkjs zkey contribute ./circuits/artifacts/setup/board_0000.zkey ./circuits/artifacts/setup/board_0001.zkey \
    --name="First board contribution" -v -e="$(head -n 4096 /dev/urandom | openssl sha1)"
yarn snarkjs zkey contribute ./circuits/artifacts/setup/shot_0000.zkey ./circuits/artifacts/setup/shot_0001.zkey \
    --name="First shot contribution" -v -e="$(head -n 4096 /dev/urandom | openssl sha1)"

yarn snarkjs zkey contribute ./circuits/artifacts/setup/board_0001.zkey ./circuits/artifacts/setup/board_0002.zkey \
    --name="Second board contribution" -v -e="$(head -n 4096 /dev/urandom | openssl sha1)"
yarn snarkjs zkey contribute ./circuits/artifacts/setup/shot_0001.zkey ./circuits/artifacts/setup/shot_0002.zkey \
    --name="Second shot contribution" -v -e="$(head -n 4096 /dev/urandom | openssl sha1)"

yarn snarkjs zkey contribute ./circuits/artifacts/setup/board_0002.zkey ./circuits/artifacts/setup/board_0003.zkey \
    --name="Third board contribution" -v -e="$(head -n 4096 /dev/urandom | openssl sha1)"
yarn snarkjs zkey contribute ./circuits/artifacts/setup/shot_0002.zkey ./circuits/artifacts/setup/shot_0003.zkey \
    --name="Third shot contribution" -v -e="$(head -n 4096 /dev/urandom | openssl sha1)"

# #  Verify zkey
yarn snarkjs zkey verify ./circuits/artifacts/setup/board.r1cs ./circuits/artifacts/ptau/pot15_final.ptau ./circuits/artifacts/setup/board_0003.zkey
yarn snarkjs zkey verify ./circuits/artifacts/setup/shot.r1cs ./circuits/artifacts/ptau/pot15_final.ptau ./circuits/artifacts/setup/shot_0003.zkey

# # Apply random beacon as before
yarn snarkjs zkey beacon ./circuits/artifacts/setup/board_0003.zkey ./circuits/artifacts/setup/board_final.zkey \
    0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Board FinalBeacon phase2"

yarn snarkjs zkey beacon ./circuits/artifacts/setup/shot_0003.zkey ./circuits/artifacts/setup/shot_final.zkey \
    0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Shot Final Beacon phase2"


# # Optional: verify final zkey
yarn snarkjs zkey verify ./circuits/artifacts/setup/board.r1cs ./circuits/artifacts/ptau/pot15_final.ptau ./circuits/artifacts/setup/board_final.zkey
yarn snarkjs zkey verify ./circuits/artifacts/setup/shot.r1cs ./circuits/artifacts/ptau/pot15_final.ptau ./circuits/artifacts/setup/shot_final.zkey

# # Export verification key
yarn snarkjs zkey export verificationkey ./circuits/artifacts/setup/board_final.zkey ./circuits/artifacts/board_verification_key.json
yarn snarkjs zkey export verificationkey ./circuits/artifacts/setup/shot_final.zkey ./circuits/artifacts/shot_verification_key.json

node ./scripts/parse_verifyingkey.js app zk-battleship board
node ./scripts/parse_verifyingkey.js app zk-battleship shot

mv ./circuits/artifacts/setup/*.zkey ./circuits/artifacts/setup/zkey
