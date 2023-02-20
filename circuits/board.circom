pragma circom 2.0.3;

include "./templates/shipRange.circom";
include "./templates/placeShip.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/mimcsponge.circom";

/*
    Validate whether or not a ship placement on a board is valid
*/
template board() {
    signal input ships[5][3];
    signal input hash;

    var lengths[5] = [5, 4, 3, 3, 2]; // length of each ship in order used

    /// RANGE CHECK ///
    component rangeCheck[5];
    for (var i = 0; i < 5; i++) {
        rangeCheck[i] = ShipRange(lengths[i]);
        // should revert if ship is illegal
        rangeCheck[i].ship[0] <== ships[i][0];
        rangeCheck[i].ship[1] <== ships[i][1];
        rangeCheck[i].ship[2] <== ships[i][2];
    }

    /// COLLISION CHECK ///
    component placeCheck[5];
    var boardNum = 0;
    for (var i = 0; i < 5; i++) {
        placeCheck[i] = PlaceShip(lengths[i]);
        placeCheck[i].ship[0] <== ships[i][0];
        placeCheck[i].ship[1] <== ships[i][1];
        placeCheck[i].ship[2] <== ships[i][2];
        placeCheck[i].boardIn <== boardNum;
        boardNum = placeCheck[i].boardOut;
    }

    /// HASH INTEGRITY CHECK ///
    component hasher = MiMCSponge(15, 220, 1);
    for (var i = 0; i < 15; i++)
        hasher.ins[i] <== ships[i \ 3][i % 3];
    hasher.k <== 0;
    hash === hasher.outs[0];
}

component main { public [hash] } = board();