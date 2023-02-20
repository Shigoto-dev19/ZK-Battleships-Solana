pragma circom 2.0.3;

include "../../node_modules/circomlib/circuits/mux1.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";

/*
   Fail if ship is not in range
   Expects x and y to be <= 9 and z to be binary
   @param n - the length of the ship
*/
template ShipRange(n) {
    signal input ship[3]; // x, y, z
    signal isOk[2]; // horizontal and vertical range compliance
    component lt[4];
    component muxOk = Mux1();

    /// HORIZONTAL ///
    // x + n < 10
    lt[0] = LessThan(4); // 4 bit number since max is 10
    lt[0].in[0] <== ship[0] + (n - 1); // n is length of ship; -1 to account for cell 0
    lt[0].in[1] <== 10;
    // y < 10
    lt[1] = LessThan(4);
    lt[1].in[0] <== ship[1];
    lt[1].in[1] <== 10;
    // make bool for range complaince to constain
    isOk[0] <== lt[0].out * lt[1].out;
    /// VERTICAL (z = 1) ///
    // x < 10
    lt[2] = LessThan(4);
    lt[2].in[0] <== ship[0];
    lt[2].in[1] <== 10;
    // y + n < 10
    lt[3] = LessThan(4);
    lt[3].in[0] <== ship[1] + (n - 1);
    lt[3].in[1] <== 10;
    // make bool for range complaince to constain
    isOk[1] <== lt[2].out * lt[3].out;
    /// SIGNAL MUX ///
    // constrain z to binary
    ship[2] * (ship[2] - 1) === 0;
    // mux1 to choose horizontal or vertical constraint
    muxOk.c[0] <== isOk[0];
    muxOk.c[1] <== isOk[1];
    muxOk.s <== ship[2];
    // constrain range
    muxOk.out === 1;
}