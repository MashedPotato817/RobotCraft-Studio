import { Quaternion, Vector3 } from 'three';
import { COURSE_PRESETS, forwardKinematics, initialQ, joints, solvePoseIK } from '../core/robot';
import type { PenJob, PenPhase, Point3 } from '../process/pen';

const mmPerUnit = 10;
const down = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI);
export const restingQ = [...initialQ];

export function jointTelemetry(q: number[]): { name: string; value: number; unit: string }[] {
  return q.map((value, i) => ({
    name: joints[i].name,
    value: joints[i].kind === 'prismatic' ? value * mmPerUnit : value * 180 / Math.PI,
    unit: joints[i].kind === 'prismatic' ? 'mm' : '°',
  }));
}

export interface RobotPose {
  points: Point3[];
  flange: Point3;
  orientation: [number, number, number, number];
  tip: Point3;
}
export interface PenSample {
  time: number;
  q: number[];
  target: Point3;
  phase: PenPhase;
  ink: number | null;
}
export interface PenPlan {
  samples: PenSample[];
  duration: number;
  penLengthMm: number;
  surfaceZmm: number;
  strokeCount: number;
  maxPositionErrorMm: number;
  maxOrientationErrorRad: number;
}
export type PlanningResult = { ok: true; plan: PenPlan } | {
  ok: false; code: 'not-converged' | 'path-discontinuity'; message: string;
};

export function robotPose(q: number[], penLengthMm: number): RobotPose {
  const fk = forwardKinematics(q);
  const transform = fk.transform.clone();
  const flange = new Vector3().setFromMatrixPosition(transform).multiplyScalar(mmPerUnit);
  transform.setPosition(flange);
  const tip = new Vector3(0, 0, penLengthMm).applyMatrix4(transform);
  return {
    points: fk.points.map(p => p.clone().multiplyScalar(mmPerUnit).toArray() as Point3),
    flange: flange.toArray() as Point3,
    orientation: new Quaternion().setFromRotationMatrix(transform).toArray() as RobotPose['orientation'],
    tip: tip.toArray() as Point3,
  };
}

export function tcpPose(q: number[], penLengthMm: number): Point3 {
  return robotPose(q, penLengthMm).tip;
}

export function planPenJob(job: PenJob): PlanningResult {
  // 一旦选择初值，就验证整条连续轨迹；失败时从头换初值，避免中途跳换逆解分支。
  const seeds = [COURSE_PRESETS.at(-1)!.q, initialQ, ...COURSE_PRESETS.slice(1, -1).map(p => p.q)];
  let failure: PlanningResult = { ok: false, code: 'not-converged', message: '没有可规划的笔画。' };
  for (const seed of seeds) {
    const result = planWithSeed(job, seed);
    if (result.ok) return result;
    failure = result;
  }
  return failure;
}

function planWithSeed(job: PenJob, startingSeed: number[]): PlanningResult {
  const samples: PenSample[] = [];
  let seed = [...startingSeed];
  let time = 0;
  let maxPositionErrorMm = 0;
  let maxOrientationErrorRad = 0;
  const toolOffset = new Vector3(0, 0, job.settings.penLengthMm).applyQuaternion(down);
  for (const [index, target] of job.targets.entries()) {
    const flangeTarget = new Vector3(...target.position).sub(toolOffset).multiplyScalar(1 / mmPerUnit);
    const solved = solvePoseIK(flangeTarget, down, seed, 300);
    const errorOf = (q: number[]) => new Vector3(...tcpPose(q, job.settings.penLengthMm)).distanceTo(new Vector3(...target.position));
    const error = errorOf(solved.q);
    maxPositionErrorMm = Math.max(maxPositionErrorMm, error);
    maxOrientationErrorRad = Math.max(maxOrientationErrorRad, solved.orientationError);
    if (!solved.converged || error > 0.5 || solved.orientationError > 0.07) {
      return { ok: false, code: 'not-converged', message: `第 ${index + 1} 个目标未通过求解校验（笔尖误差 ${error.toFixed(2)} mm），请调整图案位置或尺寸。` };
    }
    const previous = samples.at(-1);
    if (previous) {
      const midpointQ = solved.q.map((value, i) => (value + previous.q[i]) / 2);
      const midpointTip = new Vector3(...tcpPose(midpointQ, job.settings.penLengthMm));
      const midpointTarget = new Vector3(...previous.target).lerp(new Vector3(...target.position), 0.5);
      const midpointError = midpointTip.distanceTo(midpointTarget);
      const midpointAngle = new Quaternion(...robotPose(midpointQ, job.settings.penLengthMm).orientation).angleTo(down);
      maxPositionErrorMm = Math.max(maxPositionErrorMm, midpointError);
      maxOrientationErrorRad = Math.max(maxOrientationErrorRad, midpointAngle);
      if (midpointError > 0.5 || midpointAngle > 0.07) return { ok: false, code: 'path-discontinuity', message: '关节插值偏离目标路径，请缩小图案或调整位置后重试。' };
      const distance = new Vector3(...previous.target).distanceTo(new Vector3(...target.position));
      const speed = target.phase === 'draw' ? job.settings.drawSpeedMmS : 30;
      const jointTime = Math.max(...solved.q.map((value, i) => Math.abs(value - previous.q[i]) / (i === 2 ? 2 : 0.8)));
      time += Math.max(distance / speed, jointTime, 1 / 120);
    }
    samples.push({ time, q: [...solved.q], target: [...target.position], phase: target.phase, ink: target.ink });
    seed = solved.q;
  }
  return {
    ok: true,
    plan: {
      samples, duration: time, penLengthMm: job.settings.penLengthMm, surfaceZmm: job.settings.surfaceZmm,
      strokeCount: new Set(samples.filter(s => s.ink !== null).map(s => s.ink)).size,
      maxPositionErrorMm, maxOrientationErrorRad,
    },
  };
}
