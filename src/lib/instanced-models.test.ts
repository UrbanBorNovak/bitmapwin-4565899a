import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildInstances, groupModels, instanceBoxes } from "./instanced-models";
import type { WorldAsset } from "./inscribed-world-bridge";

/** A glTF-like scene: a pillar mesh under a node with its own offset/rotation. */
function scene() {
  const root = new THREE.Group();
  const node = new THREE.Group();
  node.position.set(0.5, 1, 0);
  node.rotation.y = 0.3;
  node.add(new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), new THREE.MeshBasicMaterial()));
  root.add(node);
  return root;
}

const placements: WorldAsset[] = [
  { url: "a", pos: [3, 0, -2], rot: [0, 45, 0], scale: [1, 1, 1] },
  { url: "a", pos: [-6, 2, 1], rot: [10, 90, 0], scale: [2, 1, 0.5] },
  { url: "b", pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1] },
];

describe("instanced on-chain models", () => {
  it("groups repeated inscriptions into one draw group each", () => {
    const g = groupModels(placements);
    expect(g.map((x) => [x.url, x.instances.length])).toEqual([["a", 2], ["b", 1]]);
  });

  it("collision boxes match the old per-model clone exactly", () => {
    const parent = new THREE.Group();
    parent.position.set(10, 0.2, -4);
    parent.scale.setScalar(0.01);
    const insts = buildInstances(scene(), placements.slice(0, 2));
    insts.forEach((m) => parent.add(m));
    parent.updateWorldMatrix(true, true);
    const got = instanceBoxes(insts, 3000);

    const old = placements.slice(0, 2).map((p) => {
      const c = scene();
      c.position.set(...p.pos);
      c.rotation.set(p.rot[0] * Math.PI / 180, p.rot[1] * Math.PI / 180, p.rot[2] * Math.PI / 180);
      c.scale.set(...p.scale);
      const holder = parent.clone(false);
      holder.add(c);
      holder.updateWorldMatrix(true, true);
      const b = new THREE.Box3().setFromObject(c.children[0]!.children[0]!);
      return [b.min.x, b.max.x, b.min.y, b.max.y, b.min.z, b.max.z];
    });
    expect(got).toHaveLength(2);
    got.forEach((b, i) => [b.x0, b.x1, b.y0, b.y1, b.z0, b.z1].forEach((v, k) => expect(v).toBeCloseTo(old[i]![k]!, 9)));
  });

  it("detailed meshes above the vertex limit stay walk-through", () => {
    const insts = buildInstances(scene(), placements.slice(0, 2));
    expect(instanceBoxes(insts, 10)).toHaveLength(0);
  });
});
