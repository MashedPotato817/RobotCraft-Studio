import { describe, expect, it } from 'vitest';
import { createPenJob, defaultPenSettings } from '../src/process/pen';
import { planPenJob, tcpPose } from '../src/robot/planner';
import { joints } from '../src/core/robot';

describe('笔绘规划', () => {
  it('将笔长应用到真实法兰，并把旧长度换算为毫米', () => {
    const tip = tcpPose([0, 0, 5, 0, 0, 0, 0, 0], 25);
    expect(tip[0]).toBeCloseTo(80, 8);
    expect(tip[1]).toBeCloseTo(50, 8);
    expect(tip[2]).toBeCloseTo(165, 8);
  });

  it('多笔画间先抬笔，所有加工目标都在纸面', () => {
    const job = createPenJob({ ...defaultPenSettings, pattern: 'zhong' });
    expect(new Set(job.targets.filter(p => p.ink !== null).map(p => p.ink)).size).toBe(4);
    expect(job.targets.filter(p => p.ink !== null).every(p => p.position[2] === 50)).toBe(true);
    expect(job.targets.some(p => p.phase === 'travel' && p.position[2] === 58)).toBe(true);
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
