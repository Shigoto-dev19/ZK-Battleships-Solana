pragma circom 2.0.3;

include "../../node_modules/circomlib/circuits/mux1.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";


/*
    Determine whether or not a given ship uses a given x/y coordinate pair
    @param n - the length of the ship
*/
template HitShip(n) {

    signal input ship[3]; // x, y, z to hitscan from
    signal input shot[2]; // x, y, to hitscan with
    signal output hit; // 0 if not hit, 1 if hit

    /// HORIZONTAL CONSTRAINT ///
    var hHit = 0;
    for (var i = 0; i < n; i++) {
        var _x = (ship[0] + i == shot[0]);
        var _y = (ship[1] == shot[1]);
        hHit += 1 * (_x == 1 && _y == 1);
    }
    /// VERTICAL CONSTRAINT ///
    var vHit = 0;
    for (var i = 0; i < n; i++) {
        var _x = (ship[0] == shot[0]);
        var _y = (ship[1] + i == shot[1]);
        vHit += 1 * (_x == 1 && _y == 1);
    }

    /// MUX TO CHOOSE OUTPUT ///
    component mux = Mux1();
    mux.c[0] <-- hHit;
    mux.c[1] <-- vHit;
    mux.s <== ship[2];
    hit <== mux.out;
}