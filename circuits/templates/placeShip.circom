pragma circom 2.0.3;

include "../../node_modules/circomlib/circuits/mux1.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";

/*
    Place a ship on a board while ensuring no collisions
    Input bits2num'd start board state, output bits2num'd end board state
    Expects previous safety checks and will not perform them here for resource preservation
    @param n - the length of the ship
*/
template PlaceShip(n) {
    signal input boardIn; // numerical representation of board bitmap before ship placement
    signal input ship[3]; // x, y, z of ships
    signal output boardOut; // numerical representation of board bitmap after ship placement
    component toBits = Num2Bits(100); // turns numerical board to bitmap
    component hCollision = Bits2Num(n); // track horizontal collisions
    component vCollision = Bits2Num(n); // track vertical collisions
    component collisionMux = Mux1(); // select collision check
    component boardMux = Mux1(); // select board to return
    
    /// INITIALIZE CONSTRUCTS ///
    toBits.in <== boardIn; // get board bitmap
    // initialize board placements
    var boardH[10][10]; 
    for (var i = 0; i < 100; i++) {
        boardH[i \ 10][i % 10] = toBits.out[i];
    }
    var boardV[10][10] = boardH;
    // initialize expected collision num
    component expectedCollision = Bits2Num(n);
    for (var i = 0; i < n; i++) {
        expectedCollision.in[i] <== 1;
    }
    /// HORIZONTAL PLACEMENT COLLISION CHECK ///
    for (var i = 0; i < n; i++) {
        boardH[ship[0] + i][ship[1]] += 1;
        var cellVal = boardH[ship[0] + i][ship[1]];
        hCollision.in[i] <-- cellVal * (cellVal - 1) == 0;
    }
    /// VERTICAL PLACEMENT COLLISION CHECK ///
    for (var i = 0; i < n; i++) {
        boardV[ship[0]][ship[1] + i] += 1;
        var cellVal = boardV[ship[0]][ship[1] + i];
        vCollision.in[i] <-- cellVal * (cellVal - 1) == 0;
    }
    /// MUX TO CHOOSE CONSTRAINT ///
    collisionMux.c[0] <== hCollision.out;
    collisionMux.c[1] <== vCollision.out;
    collisionMux.s <== ship[2]; // z coordinate as selector for horizontal/ vertical
    collisionMux.out === expectedCollision.out; // expect 1 if all placements have binary values (no collisions, < 2)
    /// MUX TO CHOOSE AND OUTPUT NEXT BOARD STATE ///
    // numberify bitmap
    component toNumH = Bits2Num(100); // horizontal board Bits2Num
    component toNumV = Bits2Num(100); // vertical board Bits2Num
    for (var i = 0; i < 100; i++) {
        toNumH.in[i] <-- boardH[i \ 10][i % 10];
        toNumV.in[i] <-- boardV[i \ 10][i % 10];
    }
    // mux boards to get next state
    boardMux.c[0] <== toNumH.out;
    boardMux.c[1] <== toNumV.out;
    boardMux.s <== ship[2];
    boardOut <== boardMux.out;
}