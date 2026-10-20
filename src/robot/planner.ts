import { Quaternion, Vector3 } from 'three';
import { COURSE_PRESETS, forwardKinematics, initialQ, joints, solvePoseIK } from '../core/robot';
import type { PenJob, PenPhase, Point3 } from '../process/pen';
import { armClearsBoard } from './board-clearance';
import type { ProcessConfig } from '../process/craft';

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
  config?: ProcessConfig;
}
export type PlanningResult = { ok: true; plan: PenPlan } | {
  ok: false; code: 'not-converged' | 'path-discontinuity' | 'board-intersection'; message: string;
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
    if (!failure.ok && failure.code !== 'board-intersection') failure = result;
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
    const solvedPose = robotPose(solved.q, job.settings.penLengthMm);
    const error = new Vector3(...solvedPose.tip).distanceTo(new Vector3(...target.position));
    maxPositionErrorMm = Math.max(maxPositionErrorMm, error);
    maxOrientationErrorRad = Math.max(maxOrientationErrorRad, solved.orientationError);
    if (!solved.converged || error > 0.5 || solved.orientationError > 0.07) {
      return { ok: false, code: 'not-converged', message: `第 ${index + 1} 个目标未通过求解校验（工具尖端误差 ${error.toFixed(2)} mm），请重新规划。` };
    }
    const boardFailure: PlanningResult = {
      ok: false, code: 'board-intersection', message: '当前候选轨迹无法保持机械臂与工件的间隙，请重新规划。',
    };
    if (!armClearsBoard(solvedPose.points, job.settings.surfaceZmm, job.config?.workpiece)) return boardFailure;
    const previous = samples.at(-1);
    if (previous) {
      const midpointQ = solved.q.map((value, i) => (value + previous.q[i]) / 2);
      const midpointTip = new Vector3(...tcpPose(midpointQ, job.settings.penLengthMm));
      const midpointTarget = new Vector3(...previous.target).lerp(new Vector3(...target.position), 0.5);
      const midpointError = midpointTip.distanceTo(midpointTarget);
      const midpointAngle = new Quaternion(...robotPose(midpointQ, job.settings.penLengthMm).orientation).angleTo(down);
      maxPositionErrorMm = Math.max(maxPositionErrorMm, midpointError);
      maxOrientationErrorRad = Math.max(maxOrientationErrorRad, midpointAngle);
      if (midpointError > 0.5 || midpointAngle > 0.07) return { ok: false, code: 'path-discontinuity', message: '关节插值偏离目标路径，请重新规划。' };
      for (const fraction of [0.25, 0.5, 0.75]) {
        const q = previous.q.map((value, i) => value + (solved.q[i] - value) * fraction);
        if (!armClearsBoard(robotPose(q, job.settings.penLengthMm).points, job.settings.surfaceZmm, job.config?.workpiece)) return boardFailure;
      }
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
      config: job.config,
    },
  };
}
