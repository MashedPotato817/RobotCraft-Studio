import { describe, expect, it } from 'vitest';
import { Box3, Vector3 } from 'three';
import { createCraftJob, processes, type ProcessId } from '../src/process/craft';
import { planPenJob, robotPose } from '../src/robot/planner';
import { Playback } from '../src/simulation/playback';
import type { PatternId } from '../src/design/patterns';

const combinations = (['pen', 'drill', 'cream'] as ProcessId[]).flatMap(process =>
  (['robot', 'zhong', 'flower'] as PatternId[]).map(pattern => ({ process, pattern })));

describe('固定默认参数三工艺', () => {
  it.each(combinations)('$process / $pattern 规划、间隙、结果与确定性播放', ({ process, pattern }) => {
    const job = createCraftJob(process, pattern);
    const result = planPenJob(job);
    expect(result.ok, result.ok ? '' : result.message).toBe(true);
    if (!result.ok) return;
    const plan = result.plan;
    expect(plan.maxPositionErrorMm).toBeLessThanOrEqual(0.5);
    expect(plan.maxOrientationErrorRad).toBeLessThanOrEqual(0.07);
    const w = plan.config!.workpiece;
    const bounds = new Box3(new Vector3(w.centerXmm - w.widthMm / 2, w.centerYmm - w.depthMm / 2, w.bottomMm), new Vector3(w.centerXmm + w.widthMm / 2, w.centerYmm + w.depthMm / 2, w.topMm));
    let minimumClearance = Infinity;
    for (let i = 0; i < plan.samples.length; i++) {
      const a = plan.samples[Math.max(i - 1, 0)], b = plan.samples[i];
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const q = a.q.map((v, axis) => v + (b.q[axis] - v) * t);
        const points = robotPose(q, plan.penLengthMm).points.map(p => new Vector3(...p));
        for (let link = 1; link < points.length; link++) {
          const steps = Math.max(1, Math.ceil(points[link].distanceTo(points[link - 1])));
          for (let step = 0; step <= steps; step++) {
            minimumClearance = Math.min(minimumClearance, bounds.distanceToPoint(points[link - 1].clone().lerp(points[link], step / steps)));
          }
        }
      }
    }
    // 独立采样可见连杆几何，避免只重复调用规划器的间隙判断。
    expect(minimumClearance).toBeGreaterThan(4.4);
    const slow = new Playback(plan), fast = new Playback(plan);
    slow.play(); fast.play(); fast.setSpeed(4);
    slow.advance(plan.duration / 2); fast.advance(plan.duration / 8);
    expect(fast.snapshot()).toEqual(slow.snapshot());
    const stepped = new Playback(plan); stepped.play();
    for (let frame = 0; frame < 60; frame++) stepped.advance(plan.duration / 120);
    const sampled = stepped.snapshot(), direct = slow.snapshot();
    expect(sampled.holes).toEqual(direct.holes);
    expect(sampled.ink.length).toBe(direct.ink.length);
    sampled.tip.forEach((value, axis) => expect(value).toBeCloseTo(direct.tip[axis], 8));
    sampled.ink.forEach((segment, index) => segment.end.forEach((value, axis) => expect(value).toBeCloseTo(direct.ink[index].end[axis], 8)));
    slow.pause(); const paused = slow.snapshot(); slow.advance(10);
    expect(slow.snapshot()).toEqual(paused);
    slow.play(); slow.advance(1000);
    const done = slow.snapshot();
    expect(done.state).toBe('completed');
    expect(done.drawnStrokes).toBe(plan.strokeCount);
    if (process === 'drill') {
      expect(done.ink).toEqual([]);
      expect(done.holes.length).toBeGreaterThan(3);
      done.holes.forEach(hole => {
        expect(hole.depthMm).toBeCloseTo(processes.drill.holeDepthMm, 0);
        expect(hole.depthMm).toBeLessThan(4);
      });
      const dwell = plan.samples.find(s => s.phase === 'dwell')!;
      const first = new Playback(plan); first.play(); first.advance(dwell.time - 0.001);
      expect(first.snapshot().holes).toHaveLength(0);
      first.advance(0.002); expect(first.snapshot().holes).toHaveLength(1);
    } else {
      expect(done.ink.length).toBeGreaterThan(3);
      expect(done.holes).toEqual([]);
      expect(done.ink.every(s => Math.abs(s.end[2] - plan.surfaceZmm) <= 0.5)).toBe(true);
      expect(done.ink.every(s => Math.hypot(...s.end.map((v, i) => v - s.start[i])) < 2)).toBe(true);
    }
    slow.play(); expect(slow.snapshot().ink).toEqual([]); expect(slow.snapshot().holes).toEqual([]);
    slow.advance(1000); expect(slow.snapshot()).toEqual(done);
    slow.reset(); expect(slow.snapshot().time).toBe(0); expect(slow.snapshot().drawnStrokes).toBe(0);
    console.info(`${process}/${pattern}: ${plan.samples.length} 样本, ${plan.duration.toFixed(2)} s, ${plan.maxPositionErrorMm.toFixed(3)} mm, ${plan.maxOrientationErrorRad.toFixed(4)} rad, ${plan.strokeCount} 段/孔, 连杆中心线最小间隙 ${minimumClearance.toFixed(2)} mm`);
  });

  it('钻孔孔位去重且不穿透板材，停留时间与退刀高度来自配置', () => {
    const job = createCraftJob('drill', 'flower');
    const holes = job.targets.filter(t => t.phase === 'dwell');
    expect(holes.every(t => t.holdSeconds === processes.drill.dwellSeconds)).toBe(true);
    expect(holes.every(t => t.position[2] > processes.drill.workpiece.bottomMm)).toBe(true);
    for (let i = 0; i < holes.length; i++) for (let j = i + 1; j < holes.length; j++) {
      expect(Math.hypot(...holes[i].position.map((v, axis) => v - holes[j].position[axis]))).toBeGreaterThanOrEqual(processes.drill.radiusMm * 2 + 0.5);
    }
    expect(job.targets.at(-1)!.position[2]).toBe(processes.drill.liftMm);
  });

  it('工艺切换保留所选图案，配置相互隔离', () => {
    const pen = createCraftJob('pen', 'zhong'), cream = createCraftJob('cream', 'zhong');
    expect(cream.settings.pattern).toBe(pen.settings.pattern);
    expect(cream.config!.workpiece.shape).toBe('circle');
    cream.config!.workpiece.topMm = 1000;
    expect(createCraftJob('cream', 'zhong').config!.workpiece.topMm).toBe(8);
    expect(() => createCraftJob('missing' as ProcessId, 'zhong')).toThrow();
    expect(() => createCraftJob('pen', 'missing' as PatternId)).toThrow();
  });
});
