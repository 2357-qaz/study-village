// The companion's poses as plain numbers, shared by the offline sculptor (tools/sculpt-companion.mjs)
// and the runtime (companion.js). The torso frame sits at her hips; arms are [shoulder, elbow,
// wrist] in that frame with the palm direction and finger curl; the head hangs from the neck top.
export const POSES = {
  read: {
    legs: 'seated',
    torso: {y: 0.44, z: -0.02, rx: -0.12},
    head: {tilt: 0.42, turn: 0, open: false},
    arms: [
      {
        sh: [-0.16, 0.44, 0],
        el: [-0.2, 0.22, 0.12],
        wr: [-0.12, 0.26, 0.29],
        palm: [0.6, 0.3, 0.4],
        curl: 0.55
      },
      {sh: [0.16, 0.44, 0], el: [0.2, 0.22, 0.12], wr: [0.12, 0.26, 0.29], palm: [-0.6, 0.3, 0.4], curl: 0.55}
    ]
  },
  turn: {
    legs: 'seated',
    torso: {y: 0.44, z: -0.02, rx: -0.12},
    head: {tilt: 0.42, turn: 0, open: false},
    arms: [
      {
        sh: [-0.16, 0.44, 0],
        el: [-0.2, 0.22, 0.12],
        wr: [-0.12, 0.26, 0.29],
        palm: [0.6, 0.3, 0.4],
        curl: 0.55
      },
      {sh: [0.16, 0.44, 0], el: [0.2, 0.25, 0.14], wr: [0.02, 0.36, 0.33], palm: [-0.3, -0.6, 0.4], curl: 0.2}
    ]
  },
  look: {
    legs: 'seated',
    torso: {y: 0.44, z: -0.02, rx: -0.05},
    head: {tilt: -0.08, turn: -0.32, open: true},
    arms: [
      {sh: [-0.16, 0.44, 0], el: [-0.19, 0.22, 0.08], wr: [-0.1, 0.1, 0.24], palm: [0, -1, 0], curl: 0.2},
      {sh: [0.16, 0.44, 0], el: [0.24, 0.22, 0.02], wr: [0.27, 0.07, 0.17], palm: [0, -1, 0], curl: 0.4}
    ]
  },
  tea: {
    legs: 'stand',
    torso: {y: 0.86, z: 0, rx: 0.12},
    head: {tilt: 0.38, turn: 0, open: false},
    arms: [
      {sh: [-0.16, 0.44, 0], el: [-0.18, 0.27, 0.19], wr: [-0.03, 0.33, 0.43], palm: [0, -1, 0], curl: 0.3},
      {sh: [0.16, 0.44, 0], el: [0.21, 0.27, 0.2], wr: [0.12, 0.26, 0.42], palm: [-1, 0, 0], curl: 0.8}
    ]
  }
};
// the top of the neck in the torso frame, where the head hangs
export const NECK = [0, 0.555, 0.01];
