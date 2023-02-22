# ZK Battleships Simulation

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
npm install
```
### 2. Run POT15 ceremony 
```
npm run ptau
```
### 3. Build zkeys and verification keys for each circuit
```
npm run setup
```

### 4. Use entire local test suite (circom_tester, snarkjs integration testing)
```
npm test
```
