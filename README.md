# ZK Battleships Game on Solana

## Steps (requires Linux/ OS X)
Since compatibility is a common question, M1 chips will outperform the expected wait times on ptau and setup
Node v16.17.1 was last used to compile this project, and failure to use it will break ipfs in deploy script (either use node 16 or comment out IPFS)

### 0. [Ensure Circom 2.x.x is installed locally](https://github.com/iden3/circom/blob/master/mkdocs/docs/getting-started/installation.md)
```
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom
cd ..
```
### 1. Install the neccessary dependencies
```
yarn install
```
### 2. Run POT15 ceremony 
```
yarn ptau
```
### 3. Build zkeys and verification keys for each circuit
```
yarn setup
```

### 4. Build, Deploy & Test

`anchor build` to build the solana program.

`anchor deploy` to deploy the game to localnet.

`anchor test --skip-deploy --skip-local-validator` to test the game.

### 5. Clean Circuit Artifacts

`npm run clean-artifacts` to clean all circuit artifacts.

`npm run clean-setup` to clean circuit setup excluding ptau files.

## 6. Acknowledgements

- Shoutout to [BattleZips](https://github.com/BattleZips/BattleZips/tree/master) folks for their meticulous work in integrating the ZK logic to smart contracts and their detailed documentation for their code.

- Great appreciation to [weijiekoh]('https://github.com/weijiekoh/poseidon-encryption-circom) for his poseidon encryption circuits and his contribution to many useful cryptography libraries.

- Also great appreciation to [no-stack-dub-sack](https://github.com/no-stack-dub-sack/battleship-cli) for the inspiring and cool cli that helped developing the cli of this project despite being still under development.

- All gratitude especially to [ananas-block](https://crates.io/crates/groth16-solana) for the groth16 solana verifier that without it, this project wouldn't be implementing ZK logic to the program. In addition to his support and guidance during the six months of my short career.



