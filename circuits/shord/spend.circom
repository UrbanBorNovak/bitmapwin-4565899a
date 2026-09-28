pragma circom 2.1.6;

// BITMAPWIN SHORD pool — spend circuit, reimplemented from the
// Shikhelman/Komarov "Shielded Bitcoin" construction.
//
//   note        = Poseidon(ownerX, ownerY, assetId, salt)
//   nullifier   = Poseidon(spendKey, note)
//   membership  = Poseidon binary Merkle path of depth DEPTH to `root`
//   output note = Poseidon(newOwnerX, newOwnerY, assetId, newSalt)
//   exit        = when exitFlag = 1, assetId is revealed as exitAsset (unshield)
//   intent      = public binding (fee/destination hash) so proofs can't be replayed
//
// Dev trusted setup only (single party). Not audited.

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/babyjub.circom";
include "../../node_modules/circomlib/circuits/mux1.circom";

template MerkleRoot(depth) {
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    signal output root;

    component hashers[depth];
    component muxes[depth];
    signal levels[depth + 1];
    levels[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        pathIndices[i] * (1 - pathIndices[i]) === 0;
        muxes[i] = MultiMux1(2);
        muxes[i].c[0][0] <== levels[i];
        muxes[i].c[0][1] <== pathElements[i];
        muxes[i].c[1][0] <== pathElements[i];
        muxes[i].c[1][1] <== levels[i];
        muxes[i].s <== pathIndices[i];
        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== muxes[i].out[0];
        hashers[i].inputs[1] <== muxes[i].out[1];
        levels[i + 1] <== hashers[i].out;
    }
    root <== levels[depth];
}

template Spend(depth) {
    // public
    signal input root;
    signal input nullifier;
    signal input outCommitment;
    signal input exitFlag;
    signal input exitAsset;
    signal input intent;

    // private
    signal input spendKey;
    signal input assetId;
    signal input salt;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    signal input newOwnerX;
    signal input newOwnerY;
    signal input newSalt;

    component pk = BabyPbk();
    pk.in <== spendKey;

    component note = Poseidon(4);
    note.inputs[0] <== pk.Ax;
    note.inputs[1] <== pk.Ay;
    note.inputs[2] <== assetId;
    note.inputs[3] <== salt;

    component tree = MerkleRoot(depth);
    tree.leaf <== note.out;
    for (var i = 0; i < depth; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }
    tree.root === root;

    component nf = Poseidon(2);
    nf.inputs[0] <== spendKey;
    nf.inputs[1] <== note.out;
    nf.out === nullifier;

    component out = Poseidon(4);
    out.inputs[0] <== newOwnerX;
    out.inputs[1] <== newOwnerY;
    out.inputs[2] <== assetId;
    out.inputs[3] <== newSalt;
    out.out === outCommitment;

    exitFlag * (1 - exitFlag) === 0;
    exitFlag * (exitAsset - assetId) === 0;

    signal intentSq;
    intentSq <== intent * intent;
}

component main { public [root, nullifier, outCommitment, exitFlag, exitAsset, intent] } = Spend(20);
