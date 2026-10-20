import { describe, expect, it } from 'vitest';
import { Box3, Vector3 } from 'three';
import { createPenJob, defaultPenSettings } from '../src/process/pen';
import { planPenJob, robotPose, tcpPose } from '../src/robot/planner';
import { joints } from '../src/core/robot';

describe('笔绘规划', () => {
  it.each(['robot', 'zhong', 'flower'] as const)('%s 播放全程的连杆与关节不穿过画板', pattern => {
    const job = createPenJob({ ...defaultPenSettings, pattern });
    const result = planPenJob(job);
    expect(result.ok, result.ok ? '' : result.message).toBe(true);
    if (!result.ok) return;
    const board = new Box3(new Vector3(32, -58, job.settings.surfaceZmm - 4.5), new Vector3(188, 58, job.settings.surfaceZmm));
    let smallestDistance = Infinity;
    for (let i = 0; i < result.plan.samples.length; i++) {
      const sample = result.plan.samples[i];
      const previous = result.plan.samples[Math.max(0, i - 1)];
      for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
        const q = previous.q.map((v, axis) => v + (sample.q[axis] - v) * fraction);
        const points = robotPose(q, result.plan.penLengthMm).points.map(p => new Vector3(...p));
        for (let link = 1; link < points.length; link++) {
          const steps = Math.max(1, Math.ceil(points[link].distanceTo(points[link - 1])));
          for (let s = 0; s <= steps; s++) {
            smallestDistance = Math.min(smallestDistance, board.distanceToPoint(points[link - 1].clone().lerp(points[link], s / steps)));
          }
        }
      }
    }
    // 4.4 mm 是可见关节最大半径；检查真实几何间隙而非只检查关节中心。
    expect(smallestDistance).toBeGreaterThan(4.4);
  });

  it('不允许笔尖正确但连杆穿过高画板的轨迹进入播放', () => {
    const result = planPenJob(createPenJob({ ...defaultPenSettings, pattern: 'zhong', surfaceZmm: 50 }));
    expect(result.ok).toBe(false);
  });

  it('将笔长应用到真实法兰，并把旧长度换算为毫米', () => {
    const tip = tcpPose([0, 0, 5, 0, 0, 0, 0, 0], 25);
    expect(tip[0]).toBeCloseTo(80, 8);
    expect(tip[1]).toBeCloseTo(50, 8);
    expect(tip[2]).toBeCloseTo(165, 8);
  });

  it('多笔画间先抬笔，所有加工目标都在纸面', () => {
    const job = createPenJob({ ...defaultPenSettings, pattern: 'zhong' });
    expect(new Set(job.targets.filter(p => p.ink !== null).map(p => p.ink)).size).toBe(4);
    expect(job.targets.filter(p => p.ink !== null).every(p => p.position[2] === 0)).toBe(true);
    expect(job.targets.some(p => p.phase === 'travel' && p.position[2] === 8)).toBe(true);
    for (let i = 1; i < job.targets.length; i++) {
      if (job.targets[i].ink !== null && job.targets[i - 1].ink !== null) {
        expect(job.targets[i].ink).toBe(job.targets[i - 1].ink);
      }
    }
  });

  it.each([NaN, Infinity, 0, -1, 1000])('拒绝非法尺寸 %s', sizeMm => {
    expect(() => createPenJob({ ...defaultPenSettings, sizeMm })).toThrow();
  });

  it('拒绝未知图案与非有限的工件坐标', () => {
    expect(() => createPenJob({ ...defaultPenSettings, pattern: 'missing' as 'robot' })).toThrow();
    expect(() => createPenJob({ ...defaultPenSettings, centerXmm: NaN })).toThrow();
  });

  it.each(['robot', 'zhong', 'flower'] as const)('%s 的实际笔尖跟随纸面图案，关节保持在限位内', pattern => {
    const result = planPenJob(createPenJob({ ...defaultPenSettings, pattern }));
    expect(result.ok, result.ok ? '' : result.message).toBe(true);
    if (!result.ok) return;
    expect(result.plan.maxPositionErrorMm).toBeLessThanOrEqual(0.5);
    expect(result.plan.maxOrientationErrorRad).toBeLessThanOrEqual(0.07);
    expect(result.plan.duration).toBeGreaterThan(1);
    for (const sample of result.plan.samples) {
      sample.q.forEach((q, i) => {
        expect(q).toBeGreaterThanOrEqual(joints[i].min);
        expect(q).toBeLessThanOrEqual(joints[i].max);
      });
      const tip = tcpPose(sample.q, result.plan.penLengthMm);
      expect(Math.hypot(...tip.map((v, i) => v - sample.target[i]))).toBeLessThanOrEqual(0.5);
    }
  });

  it('未收敛的目标返回诊断，不返回可播放轨迹', () => {
    const job = createPenJob(defaultPenSettings);
    job.targets[0].position = [10000, 0, 50];
    const result = planPenJob(job);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('not-converged');
  });
});
