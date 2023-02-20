pragma circom 2.0.3;

include "../node_modules/circomlib/circuits/gates.circom";
include "../node_modules/circomlib/circuits/mimcsponge.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "./templates/hitShip.circom";

/*
    determine whether or not a shot hit a given board arrangement
    proving:
      - whether a given coordinate pair hits a ship placement
      - shipHash is the hash of the placement
*/
template shot() {
    signal input ships[5][3]; // x, y, z of ship placements
    signal input hash; // mimcSponge hash on each element of coordinate (15x)
    signal input shot[2]; // x, y to hitscan
    signal input hit; // public assertion of hit or miss for coordinates

    signal _hit[5]; // intermediary OR'd hit registry
    signal _ors[4]; // or result registry

    /// SHOT RANGE CHECK ///
    component ltX = LessThan(4);
    component ltY = LessThan(4);
    ltX.in[0] <== shot[0];
    ltX.in[1] <== 10;
    ltY.in[0] <== shot[1];
    ltY.in[1] <== 10;
    ltX.out * ltY.out === 1;

    /// HASH INTEGRITY CHECK ///
    component hasher = MiMCSponge(15, 220, 1);
    for (var i = 0; i < 15; i++)
        hasher.ins[i] <== ships[i \ 3][i % 3];
    hasher.k <== 0;
    hash === hasher.outs[0];

    /// HIT SCAN ///
    var lengths[5] = [5, 4, 3, 3, 2];
    // scan for hits //
    component hitCheck[5];
    for (var i = 0; i < 5; i++) {
        hitCheck[i] = HitShip(lengths[i]);
        hitCheck[i].ship[0] <== ships[i][0];
        hitCheck[i].ship[1] <== ships[i][1];
        hitCheck[i].ship[2] <== ships[i][2];
        hitCheck[i].shot[0] <== shot[0];
        hitCheck[i].shot[1] <== shot[1];
        _hit[i] <== hitCheck[i].hit;
    }

    // OR operation on hit registry //
    component ors[4];
    ors[0] = OR();
    ors[0].a <== _hit[0];
    ors[0].b <== _hit[1];
    _ors[0] <== ors[0].out;
    for (var i = 1; i < 4; i++) {
        ors[i] = OR();
        ors[i].a <== _ors[i - 1];
        ors[i].b <== _hit[i + 1];
        _ors[i] <== ors[i].out;
    }
    
    /// HIT ASSERTION CHECK ///
    hit === ors[3].out;
}

component main { public [hash, shot, hit] } = shot();