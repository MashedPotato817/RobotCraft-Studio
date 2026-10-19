import * as THREE from 'three';

export type JointKind = 'revolute' | 'prismatic';

export interface JointDefinition {
  name: string;
  kind: JointKind;
  d: number;
  a: number;
  alpha: number;
  min: number;
  max: number;
}

export interface KinematicsResult {
  transform: THREE.Matrix4;
  transforms: THREE.Matrix4[];
  points: THREE.Vector3[];
}

const deg = (value: number) => THREE.MathUtils.degToRad(value);

/** 标准 DH: Rot(z, θ) · Trans(z, d) · Trans(x, a) · Rot(x, α). */
export const joints: JointDefinition[] = [
  { name: 'J1', kind: 'revolute', d: 5, a: 0, alpha: -Math.PI / 2, min: deg(-170), max: deg(170) },
  { name: 'J2', kind: 'revolute', d: 2, a: 0, alpha: Math.PI / 2, min: deg(-135), max: deg(135) },
  { name: 'J3', kind: 'prismatic', d: 0, a: 0, alpha: 0, min: 3, max: 10 },
  { name: 'J4', kind: 'revolute', d: 0, a: 3, alpha: -Math.PI / 2, min: deg(-180), max: deg(180) },
  { name: 'J5', kind: 'revolute', d: 0, a: 2, alpha: Math.PI / 2, min: deg(-90), max: deg(90) },
  { name: 'J6', kind: 'revolute', d: 4, a: 0, alpha: 0, min: deg(-180), max: deg(180) },
  { name: 'J7', kind: 'revolute', d: 0, a: 3, alpha: -Math.PI / 2, min: deg(-135), max: deg(135) },
  { name: 'J8', kind: 'revolute', d: 3, a: 0, alpha: Math.PI / 2, min: deg(-90), max: deg(90) },
];

export const initialQ = [0, Math.PI / 6, 5, -Math.PI / 4, Math.PI / 6, 0, Math.PI / 6, 0];

export interface CoursePreset {
  id: string;
  name: string;
  tag: string;
  description: string;
  q: number[];
  theoreticalPos: [number, number, number];
  theoreticalMatrix: number[][];
}

export const COURSE_PRESETS: CoursePreset[] = [
  {
    id: 'init',
    name: '初始位姿 (init)',
    tag: '基础位形',
    description: '实验一、二、三的基准构型，第3关节滑动位移 5.0，其余转角为 [0°, 30°, 5, -45°, 30°, 0°, 30°, 0°]',
    q: [0, Math.PI / 6, 5, -Math.PI / 4, Math.PI / 6, 0, Math.PI / 6, 0],
    theoreticalPos: [10.672, -0.535, 6.823],
    theoreticalMatrix: [
      [0.549, 0.390, 0.739, 10.672],
      [-0.177, 0.919, -0.354, -0.535],
      [-0.817, 0.063, 0.573, 6.823],
      [0, 0, 0, 1]
    ]
  },
  {
    id: 'aid0',
    name: '实验二 目标 1 (aid0)',
    tag: '目标 1',
    description: '关节变量 [0°, 45°, 5, 0°, -90°, 0°, 30°, 0°]，用于验证齐次变换矩阵 T0',
    q: [0, Math.PI / 4, 5, 0, -Math.PI / 2, 0, Math.PI / 6, 0],
    theoreticalPos: [5.019, 6.098, 11.433],
    theoreticalMatrix: [
      [0.6124, -0.3536, -0.7071, 5.019],
      [0.5, 0.866, 0.0, 6.098],
      [0.6124, -0.3536, 0.7071, 11.433],
      [0, 0, 0, 1]
    ]
  },
  {
    id: 'aid1',
    name: '实验二 目标 2 (aid1)',
    tag: '目标 2',
    description: '关节变量 [-90°, 45°, 6, 0°, 90°, 0°, -30°, 0°]，移动关节伸长至 6.0',
    q: [-Math.PI / 2, Math.PI / 4, 6, 0, Math.PI / 2, 0, -Math.PI / 6, 0],
    theoreticalPos: [3.098, -4.880, -0.019],
    theoreticalMatrix: [
      [-0.5, 0.866, 0.0, 3.098],
      [0.6124, 0.3536, -0.7071, -4.880],
      [-0.6124, -0.3536, -0.7071, -0.019],
      [0, 0, 0, 1]
    ]
  },
  {
    id: 'aid2',
    name: '实验二 目标 3 (aid2)',
    tag: '目标 3',
    description: '关节变量 [-90°, 45°, 7, 0°, 90°, 0°, 45°, 0°]，移动关节伸长至 7.0',
    q: [-Math.PI / 2, Math.PI / 4, 7, 0, Math.PI / 2, 0, Math.PI / 4, 0],
    theoreticalPos: [6.243, -8.485, 3.586],
    theoreticalMatrix: [
      [0.7071, 0.7071, 0.0, 6.243],
      [0.5, -0.5, -0.7071, -8.485],
      [-0.5, 0.5, -0.7071, 3.586],
      [0, 0, 0, 1]
    ]
  },
  {
    id: 'aid3',
    name: '实验二 目标 4 (aid3)',
    tag: '目标 4',
    description: '关节变量 [90°, 45°, 8, 0°, -90°, 0°, -45°, 0°]，移动关节伸长至 8.0',
    q: [Math.PI / 2, Math.PI / 4, 8, 0, -Math.PI / 2, 0, -Math.PI / 4, 0],
    theoreticalPos: [-2.000, 9.364, 15.778],
    theoreticalMatrix: [
      [0.7071, -0.7071, 0.0, -2.000],
      [0.5, 0.5, -0.7071, 9.364],
      [0.5, 0.5, 0.7071, 15.778],
      [0, 0, 0, 1]
    ]
  },
  {
    id: 'aid4',
    name: '实验二 目标 5 (aid4)',
    tag: '目标 5',
    description: '关节变量 [-90°, -45°, 5, 0°, -90°, 0°, 60°, 0°]，移动副 5.0，关节5为负角度',
    q: [-Math.PI / 2, -Math.PI / 4, 5, 0, -Math.PI / 2, 0, Math.PI / 3, 0],
    theoreticalPos: [6.098, 4.880, 8.466],
    theoreticalMatrix: [
      [0.866, 0.5, 0.0, 6.098],
      [0.3536, -0.6124, 0.7071, 4.880],
      [0.3536, -0.6124, -0.7071, 8.466],
      [0, 0, 0, 1]
    ]
  }
];

export function evaluatePresetDiscrepancy(q: number[], theoreticalMatrix: number[][]) {
  const result = forwardKinematics(q);
  const elements = result.transform.elements;
  let maxDiff = 0;
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const actual = elements[col * 4 + row];
      const theo = theoreticalMatrix[row][col];
      const diff = Math.abs(actual - theo);
      if (diff > maxDiff) maxDiff = diff;
    }
  }
  const endPoint = result.points.at(-1)!;
  const theoPos = new THREE.Vector3(theoreticalMatrix[0][3], theoreticalMatrix[1][3], theoreticalMatrix[2][3]);
  const posError = endPoint.distanceTo(theoPos);
  return { maxDiff, posError, actualPos: endPoint };
}

export function clampConfiguration(q: number[]): number[] {
  return q.map((value, index) => THREE.MathUtils.clamp(value, joints[index].min, joints[index].max));
}

export function forwardKinematics(q: number[]): KinematicsResult {
  let current = new THREE.Matrix4().identity();
  const transforms: THREE.Matrix4[] = [current.clone()];
  const points: THREE.Vector3[] = [new THREE.Vector3()];
  joints.forEach((joint, index) => {
    const theta = joint.kind === 'revolute' ? q[index] : 0;
    const d = joint.kind === 'prismatic' ? q[index] : joint.d;
    const dh = new THREE.Matrix4()
      .makeRotationZ(theta)
      .multiply(new THREE.Matrix4().makeTranslation(0, 0, d))
      .multiply(new THREE.Matrix4().makeTranslation(joint.a, 0, 0))
      .multiply(new THREE.Matrix4().makeRotationX(joint.alpha));
    current = current.clone().multiply(dh);
    transforms.push(current.clone());
    points.push(new THREE.Vector3().setFromMatrixPosition(current));
  });
  return { transform: current, transforms, points };
}

export interface IkResult {
  q: number[];
  error: number;
  iterations: number;
  converged: boolean;
}

export interface PoseIkResult extends IkResult {
  orientationError: number;
}

export interface GeometricJacobianResult {
  Jv: number[][]; // 3x8 linear velocity Jacobian
  Jw: number[][]; // 3x8 angular velocity Jacobian
  J: number[][];  // 6x8 full geometric Jacobian
  fk: KinematicsResult;
}

/**
 * 解析几何雅可比矩阵（Craig《机器人学导论》第5章原理）
 * 依据一次正运动学中各关节连杆变换矩阵，直接解析推导 Jv 与 Jw，完全消灭数值有限微商的截断误差。
 */
export function geometricJacobian(q: number[]): GeometricJacobianResult {
  const fk = forwardKinematics(q);
  const pe = fk.points.at(-1)!;
  const Jv: number[][] = Array.from({ length: 3 }, () => Array(8).fill(0));
  const Jw: number[][] = Array.from({ length: 3 }, () => Array(8).fill(0));
  const J: number[][] = Array.from({ length: 6 }, () => Array(8).fill(0));

  for (let i = 0; i < 8; i += 1) {
    const te = fk.transforms[i].elements;
    // z axis of joint frame i in base coordinates (column 2 of transform matrix)
    const zx = te[8], zy = te[9], zz = te[10];
    const pi = fk.points[i];

    if (joints[i].kind === 'revolute') {
      const rx = pe.x - pi.x;
      const ry = pe.y - pi.y;
      const rz = pe.z - pi.z;
      // Jv = z x r
      const vx = zy * rz - zz * ry;
      const vy = zz * rx - zx * rz;
      const vz = zx * ry - zy * rx;
      Jv[0][i] = vx; Jv[1][i] = vy; Jv[2][i] = vz;
      Jw[0][i] = zx; Jw[1][i] = zy; Jw[2][i] = zz;
      J[0][i] = vx; J[1][i] = vy; J[2][i] = vz;
      J[3][i] = zx; J[4][i] = zy; J[5][i] = zz;
    } else {
      // prismatic (joint 3): Jv = z, Jw = 0
      Jv[0][i] = zx; Jv[1][i] = zy; Jv[2][i] = zz;
      Jw[0][i] = 0; Jw[1][i] = 0; Jw[2][i] = 0;
      J[0][i] = zx; J[1][i] = zy; J[2][i] = zz;
      J[3][i] = 0; J[4][i] = 0; J[5][i] = 0;
    }
  }
  return { Jv, Jw, J, fk };
}

/** Yoshikawa 可操作度测度: w = sqrt(det(Jv * Jv^T))，表征机械臂在当前构型下的运动灵巧度 */
export function computeManipulability(q: number[]): number {
  const { Jv } = geometricJacobian(q);
  const m00 = Jv[0].reduce((s, v) => s + v * v, 0);
  const m01 = Jv[0].reduce((s, v, k) => s + v * Jv[1][k], 0);
  const m02 = Jv[0].reduce((s, v, k) => s + v * Jv[2][k], 0);
  const m11 = Jv[1].reduce((s, v) => s + v * v, 0);
  const m12 = Jv[1].reduce((s, v, k) => s + v * Jv[2][k], 0);
  const m22 = Jv[2].reduce((s, v) => s + v * v, 0);

  const det =
    m00 * (m11 * m22 - m12 * m12) -
    m01 * (m01 * m22 - m12 * m02) +
    m02 * (m01 * m12 - m11 * m02);

  return Math.sqrt(Math.max(0, det));
}

/** 关节行程限位势能梯度: 驱动关节远离限位死角，趋向行程中间舒适区 */
export function jointLimitGradient(q: number[]): number[] {
  return q.map((val, idx) => {
    const min = joints[idx].min;
    const max = joints[idx].max;
    const mid = (min + max) * 0.5;
    const span = max - min;
    return -2 * (val - mid) / (span * span);
  });
}

function multiplyMatrixVector(matrix: number[][], vector: number[]): number[] {
  return matrix.map(row => row.reduce((sum, value, index) => sum + value * vector[index], 0));
}

/** DLS 伪逆 J† = Jᵀ(JJᵀ + λ²I)⁻¹；适用于 3×8 或 6×8 雅可比矩阵。 */
function dampedPseudoInverse(jacobian: number[][], damping: number): number[][] | null {
  const rows = jacobian.length;
  const columns = jacobian[0].length;
  const jjT = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: rows }, (_, col) =>
      jacobian[row].reduce((sum, value, index) => sum + value * jacobian[col][index], row === col ? damping ** 2 : 0)
    )
  );
  const inverseColumns = Array.from({ length: rows }, (_, column) => {
    const unit = Array.from({ length: rows }, (_, index) => index === column ? 1 : 0);
    return solveLinearSystem(jjT, unit);
  });
  if (inverseColumns.some(column => column === null)) return null;
  const inverse = Array.from({ length: rows }, (_, row) => inverseColumns.map(column => column![row]));
  return Array.from({ length: columns }, (_, column) =>
    Array.from({ length: rows }, (_, row) => jacobian.reduce((sum, values, index) => sum + values[column] * inverse[index][row], 0))
  );
}

/**
 * 零空间限位回避步：P∇H = (I - J†J)∇H。
 * 该步在一阶近似下不改变末端主任务，仅将冗余自由度推向行程中点。
 */
export function nullSpaceJointLimitStep(
  jacobian: number[][],
  q: number[],
  damping: number,
  weight: number
): number[] {
  const pseudoInverse = dampedPseudoInverse(jacobian, damping);
  if (!pseudoInverse) return Array(q.length).fill(0);
  const gradient = jointLimitGradient(q);
  const projected = gradient.map((value, index) =>
    value - multiplyMatrixVector(pseudoInverse, multiplyMatrixVector(jacobian, gradient))[index]
  );
  return projected.map(value => value * weight);
}

/** Damped least-squares position IK with geometric Jacobian and null-space joint limit avoidance */
export function solvePositionIK(target: THREE.Vector3, seed: number[], maxIterations = 180): IkResult {
  let q = clampConfiguration(seed);
  const damping = 0.18;
  const nullspaceWeight = 0.025;
  let error = Infinity;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const { Jv, fk } = geometricJacobian(q);
    const end = fk.points.at(-1)!;
    const delta = target.clone().sub(end);
    error = delta.length();
    if (error < 0.015) return { q, error, iterations: iteration + 1, converged: true };

    const pseudoInverse = dampedPseudoInverse(Jv, damping);
    if (!pseudoInverse) break;
    const primaryStep = multiplyMatrixVector(pseudoInverse, [delta.x, delta.y, delta.z]);
    const secondaryStep = nullSpaceJointLimitStep(Jv, q, damping, nullspaceWeight);

    q = clampConfiguration(q.map((value, index) =>
      value + THREE.MathUtils.clamp(primaryStep[index] + secondaryStep[index], -0.16, 0.16)
    ));
  }
  error = forwardKinematics(q).points.at(-1)!.distanceTo(target);
  return { q, error, iterations: maxIterations, converged: error < 0.04 };
}

export function rotationVector(from: THREE.Quaternion, to: THREE.Quaternion): THREE.Vector3 {
  const delta = to.clone().multiply(from.clone().invert()).normalize();
  if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
  const sine = Math.sqrt(delta.x ** 2 + delta.y ** 2 + delta.z ** 2);
  if (sine < 1e-8) return new THREE.Vector3();
  return new THREE.Vector3(delta.x, delta.y, delta.z).multiplyScalar((2 * Math.atan2(sine, delta.w)) / sine);
}

function solveLinearSystem(matrix: number[][], vector: number[]): number[] | null {
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let pivot = 0; pivot < augmented.length; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < augmented.length; row += 1) if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[best][pivot])) best = row;
    if (Math.abs(augmented[best][pivot]) < 1e-10) return null;
    [augmented[pivot], augmented[best]] = [augmented[best], augmented[pivot]];
    const divisor = augmented[pivot][pivot];
    for (let col = pivot; col <= augmented.length; col += 1) augmented[pivot][col] /= divisor;
    for (let row = 0; row < augmented.length; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      for (let col = pivot; col <= augmented.length; col += 1) augmented[row][col] -= factor * augmented[pivot][col];
    }
  }
  return augmented.map(row => row.at(-1)!);
}

/** Six-dimensional geometric DLS IK with tool orientation locked and null-space avoidance */
export function solvePoseIK(
  target: THREE.Vector3,
  targetOrientation: THREE.Quaternion,
  seed: number[],
  maxIterations = 110
): PoseIkResult {
  let q = clampConfiguration(seed);
  const orientationWeight = 2.2;
  const damping = 0.22;
  const nullspaceWeight = 0.025;
  let positionError = Infinity;
  let orientationError = Infinity;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const { J, fk } = geometricJacobian(q);
    const position = fk.points.at(-1)!;
    const orientation = new THREE.Quaternion().setFromRotationMatrix(fk.transform);
    const positionDelta = target.clone().sub(position);
    const rotationDelta = rotationVector(orientation, targetOrientation);
    positionError = positionDelta.length();
    orientationError = rotationDelta.length();
    if (positionError < 0.012 && orientationError < 0.018) {
      return { q, error: positionError, orientationError, iterations: iteration + 1, converged: true };
    }

    const weightedJ = J.map((row, rIdx) =>
      rIdx >= 3 ? row.map(v => v * orientationWeight) : [...row]
    );
    const residual = [
      positionDelta.x,
      positionDelta.y,
      positionDelta.z,
      rotationDelta.x * orientationWeight,
      rotationDelta.y * orientationWeight,
      rotationDelta.z * orientationWeight,
    ];

    const pseudoInverse = dampedPseudoInverse(weightedJ, damping);
    if (!pseudoInverse) break;
    const primaryStep = multiplyMatrixVector(pseudoInverse, residual);
    const secondaryStep = nullSpaceJointLimitStep(weightedJ, q, damping, nullspaceWeight);

    q = clampConfiguration(q.map((value, index) =>
      value + THREE.MathUtils.clamp(primaryStep[index] + secondaryStep[index], -0.12, 0.12)
    ));
  }
  const result = forwardKinematics(q);
  positionError = result.points.at(-1)!.distanceTo(target);
  orientationError = rotationVector(
    new THREE.Quaternion().setFromRotationMatrix(result.transform),
    targetOrientation
  ).length();
  return {
    q,
    error: positionError,
    orientationError,
    iterations: maxIterations,
    converged: positionError < 0.05 && orientationError < 0.07,
  };
}

export function formatJoint(value: number, index: number): string {
  return joints[index].kind === 'prismatic' ? value.toFixed(2) : `${THREE.MathUtils.radToDeg(value).toFixed(1)}°`;
}
