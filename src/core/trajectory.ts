import * as THREE from 'three';
import { COURSE_PRESETS, forwardKinematics, initialQ, solvePoseIK, solvePositionIK } from './robot';

export interface Trajectory {
  samples: number[][];
  actualPoints: THREE.Vector3[];
  maxPositionError: number;
  maxOrientationError: number;
}

export const shapeLabels = {
  circle: '圆形',
  square: '正方形',
  rectangle: '矩形',
  heart: '心形',
  lab3_loop: '实验三 五段工件闭环',
  lab2_patrol: '实验二 五目标巡检',
} as const;
export type ShapeName = keyof typeof shapeLabels;

/** 三次多项式插值（实验三原理）：s(u) = 3*u^2 - 2*u^3, u in [0, 1] */
export function cubicInterpolate(q0: number[], q1: number[], steps = 30): number[][] {
  return Array.from({ length: steps }, (_, i) => {
    const u = i / (steps - 1);
    const s = 3 * u * u - 2 * u * u * u;
    return q0.map((v0, idx) => v0 + (q1[idx] - v0) * s);
  });
}

/** 五次多项式插值（MATLAB 工具箱 jtraj 原理）：s(u) = 10*u^3 - 15*u^4 + 6*u^5, u in [0, 1] */
export function quinticInterpolate(q0: number[], q1: number[], steps = 30): number[][] {
  return Array.from({ length: steps }, (_, i) => {
    const u = i / (steps - 1);
    const s = 10 * u ** 3 - 15 * u ** 4 + 6 * u ** 5;
    return q0.map((v0, idx) => v0 + (q1[idx] - v0) * s);
  });
}

export function buildMultiSegmentTrajectory(waypointsQ: number[][], stepsPerSegment = 26): Trajectory {
  const samples: number[][] = [];
  const actualPoints: THREE.Vector3[] = [];
  for (let seg = 0; seg < waypointsQ.length - 1; seg += 1) {
    const qA = waypointsQ[seg];
    const qB = waypointsQ[seg + 1];
    const segSamples = quinticInterpolate(qA, qB, stepsPerSegment);
    const slice = seg === waypointsQ.length - 2 ? segSamples : segSamples.slice(0, -1);
    for (const q of slice) {
      samples.push(q);
      actualPoints.push(forwardKinematics(q).points.at(-1)!);
    }
  }
  return { samples, actualPoints, maxPositionError: 0, maxOrientationError: 0 };
}

function targetPoint(shape: Exclude<ShapeName, 'lab3_loop' | 'lab2_patrol'>, start: THREE.Vector3, u: number): THREE.Vector3 {
  const t = Math.PI * 2 * u;
  if (shape === 'circle') return start.clone().add(new THREE.Vector3(1.45 * (Math.cos(t) - 1), 0, 1.45 * Math.sin(t)));
  if (shape === 'heart') {
    const scale = 0.115;
    const x = 16 * Math.sin(t) ** 3 * scale;
    const z = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t) - 5) * scale;
    return start.clone().add(new THREE.Vector3(x, 0, z));
  }
  const width = shape === 'square' ? 2.6 : 3.6;
  const height = shape === 'square' ? 2.6 : 1.9;
  const perimeter = 2 * (width + height);
  let distance = u * perimeter;
  if (distance <= width) return start.clone().add(new THREE.Vector3(-distance, 0, 0));
  distance -= width;
  if (distance <= height) return start.clone().add(new THREE.Vector3(-width, 0, -distance));
  distance -= height;
  if (distance <= width) return start.clone().add(new THREE.Vector3(-width + distance, 0, -height));
  distance -= width;
  return start.clone().add(new THREE.Vector3(0, 0, -height + distance));
}

/** Creates a Cartesian or joint-space trajectory matching reference course cases. */
export function buildShapeTrajectory(shape: ShapeName, sampleCount = 144): Trajectory {
  if (shape === 'lab2_patrol') {
    const qList = COURSE_PRESETS.map(p => p.q);
    qList.push(COURSE_PRESETS[0].q); // closed loop back to init
    return buildMultiSegmentTrajectory(qList, 25);
  }

  if (shape === 'lab3_loop') {
    const q0 = [...COURSE_PRESETS[1].q]; // aid0
    const w1 = solvePositionIK(new THREE.Vector3(0.5, 0.0, 0.0), q0, 250).q;
    const w2 = solvePositionIK(new THREE.Vector3(0.5, 0.0, -0.4), w1, 250).q;
    const w3 = solvePositionIK(new THREE.Vector3(-0.1, 0.5, -0.4), w2, 250).q;
    const w4 = solvePositionIK(new THREE.Vector3(-0.1, 0.5, 0.1), w3, 250).q;
    return buildMultiSegmentTrajectory([q0, w1, w2, w3, w4, q0], 29);
  }

  const startResult = forwardKinematics(initialQ);
  const start = startResult.points.at(-1)!;
  const lockedOrientation = new THREE.Quaternion().setFromRotationMatrix(startResult.transform);
  const samples: number[][] = [];
  const actualPoints: THREE.Vector3[] = [];
  let seed = [...initialQ];
  let maxPositionError = 0;
  let maxOrientationError = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const solved = solvePoseIK(targetPoint(shape, start, index / (sampleCount - 1)), lockedOrientation, seed);
    seed = solved.q;
    samples.push(seed);
    actualPoints.push(forwardKinematics(seed).points.at(-1)!);
    maxPositionError = Math.max(maxPositionError, solved.error);
    maxOrientationError = Math.max(maxOrientationError, solved.orientationError);
  }
  return { samples, actualPoints, maxPositionError, maxOrientationError };
}

