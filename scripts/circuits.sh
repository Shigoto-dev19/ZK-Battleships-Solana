#!/bin/sh
set -e

# --------------------------------------------------------------------------------
# Phase 2
# ... circuit-specific stuff

# if circuits/artifacts does not exist, make folder
[ -d ./circuits/artifacts ] || mkdir ./circuits/artifacts
# if artifacts/setup does not exist, make folder
[ -d ./circuits/artifacts/setup ] || mkdir ./circuits/artifacts/setup
# if setup/zkey does not exist, make folder
[ -d ./circuits/artifacts/setup/zkey ] || mkdir ./circuits/artifacts/setup/zkey

# Compile circuits
circom ./circuits/board.circom -o ./circuits/artifacts/setup --r1cs --wasm
circom ./circuits/shot.circom -o ./circuits/artifacts/setup --r1cs --wasm

#Setup
npx snarkjs groth16 setup ./circuits/artifacts/setup/board.r1cs ./circuits/artifacts/ptau/pot15_final.ptau ./circuits/artifacts/setup/board_final.zkey
npx snarkjs groth16 setup ./circuits/artifacts/setup/shot.r1cs ./circuits/artifacts/ptau/pot15_final.ptau ./circuits/artifacts/setup/shot_final.zkey

# # Generate reference zkey
npx snarkjs zkey new ./circuits/artifacts/setup/board.r1cs ./circuits/artifacts/ptau/pot15_final.ptau ./circuits/artifacts/setup/board_0000.zkey
npx snarkjs zkey new ./circuits/artifacts/setup/shot.r1cs ./circuits/artifacts/ptau/pot15_final.ptau ./circuits/artifacts/setup/shot_0000.zkey

# # Ceremony just like before but for zkey this time
npx snarkjs zkey contribute ./circuits/artifacts/setup/board_0000.zkey ./circuits/artifacts/setup/board_0001.zkey \
    --name="First board contribution" -v -e="$(head -n 4096 /dev/urandom | openssl sha1)"
npx snarkjs zkey contribute ./circuits/artifacts/setup/shot_0000.zkey ./circuits/artifacts/setup/shot_0001.zkey \
    --name="First shot contribution" -v -e="$(head -n 4096 /dev/urandom | openssl sha1)"
npx snarkjs zkey contribute ./circuits/artifacts/setup/board_0001.zkey ./circuits/artifacts/setup/board_0002.zkey \
    --name="Second board contribution" -v -e="$(head -n 4096 /dev/urandom | openssl sha1)"
npx snarkjs zkey contribute ./circuits/artifacts/setup/shot_0001.zkey ./circuits/artifacts/setup/shot_0002.zkey \
    --name="Second shot contribution" -v -e="$(head -n 4096 /dev/urandom | openssl sha1)"
npx snarkjs zkey contribute ./circuits/artifacts/setup/board_0002.zkey ./circuits/artifacts/setup/board_0003.zkey \
    --name="Third board contribution" -v -e="$(head -n 4096 /dev/urandom | openssl sha1)"
npx snarkjs zkey contribute ./circuits/artifacts/setup/shot_0002.zkey ./circuits/artifacts/setup/shot_0003.zkey \
    --name="Third shot contribution" -v -e="$(head -n 4096 /dev/urandom | openssl sha1)"

# #  Verify zkey
npx snarkjs zkey verify ./circuits/artifacts/setup/board.r1cs ./circuits/artifacts/ptau/pot15_final.ptau ./circuits/artifacts/setup/board_0003.zkey
npx snarkjs zkey verify ./circuits/artifacts/setup/shot.r1cs ./circuits/artifacts/ptau/pot15_final.ptau ./circuits/artifacts/setup/shot_0003.zkey

# # Apply random beacon as before
npx snarkjs zkey beacon ./circuits/artifacts/setup/board_0003.zkey ./circuits/artifacts/setup/board_final.zkey \
    0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Board FinalBeacon phase2"

npx snarkjs zkey beacon ./circuits/artifacts/setup/shot_0003.zkey ./circuits/artifacts/setup/shot_final.zkey \
    0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Shot Final Beacon phase2"

# # Optional: verify final zkey
npx snarkjs zkey verify ./circuits/artifacts/setup/board.r1cs ./circuits/artifacts/ptau/pot15_final.ptau ./circuits/artifacts/setup/board_final.zkey
npx snarkjs zkey verify ./circuits/artifacts/setup/shot.r1cs ./circuits/artifacts/ptau/pot15_final.ptau ./circuits/artifacts/setup/shot_final.zkey

# # Export verification key
npx snarkjs zkey export verificationkey ./circuits/artifacts/setup/board_final.zkey ./circuits/artifacts/board_verification_key.json
npx snarkjs zkey export verificationkey ./circuits/artifacts/setup/shot_final.zkey ./circuits/artifacts/shot_verification_key.json

mv ./circuits/artifacts/setup/*.zkey ./circuits/artifacts/setup/zkey
