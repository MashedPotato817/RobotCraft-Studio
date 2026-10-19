import { describe, expect, it } from 'vitest';
import { Playback } from '../src/simulation/playback';
import { createPenJob, defaultPenSettings } from '../src/process/pen';
import { planPenJob } from '../src/robot/planner';

const result = planPenJob(createPenJob({ ...defaultPenSettings, pattern: 'zhong' }));
if (!result.ok) throw new Error(result.message);
const plan = result.plan;

describe('确定性笔绘播放', () => {
  it('暂停不走时，继续后从原位置播放', () => {
    const player = new Playback(plan);
    player.play();
    player.advance(1);
    player.pause();
    const paused = player.snapshot();
    player.advance(8);
    expect(player.snapshot()).toEqual(paused);
    player.play();
    player.advance(1);
    expect(player.snapshot().time).toBeCloseTo(2);
  });

  it('大步与小步推进生成相同笔迹，调速只影响时间推进', () => {
    const a = new Playback(plan);
    const b = new Playback(plan);
    a.play(); b.play();
    a.advance(4);
    for (let i = 0; i < 40; i++) b.advance(0.1);
    const expected = a.snapshot();
    const actual = b.snapshot();
    expect(actual.ink.length).toBe(expected.ink.length);
    actual.tip.forEach((v, i) => expect(v).toBeCloseTo(expected.tip[i], 8));
    actual.ink.forEach((s, i) => s.end.forEach((v, axis) => expect(v).toBeCloseTo(expected.ink[i].end[axis], 8)));
    const fast = new Playback(plan);
    fast.setSpeed(2); fast.play(); fast.advance(2);
    expect(fast.snapshot()).toEqual(expected);
  });

  it('完成后保留末样本和全部笔迹，重置清除笔迹与进度', () => {
    const player = new Playback(plan);
    player.play(); player.advance(1000);
    const done = player.snapshot();
    expect(done.state).toBe('completed');
    expect(done.progress).toBe(1);
    expect(done.q).toEqual(plan.samples.at(-1)!.q);
    expect(done.drawnStrokes).toBe(4);
    player.advance(1);
    expect(player.snapshot()).toEqual(done);
    player.reset();
    expect(player.snapshot().state).toBe('ready');
    expect(player.snapshot().ink).toEqual([]);
    expect(player.snapshot().time).toBe(0);
  });

  it('空行程不出墨，四笔之间没有桥接线', () => {
    const player = new Playback(plan);
    player.play(); player.advance(1000);
    const ink = player.snapshot().ink;
    expect(new Set(ink.map(s => s.stroke)).size).toBe(4);
    expect(ink.every(s => Math.abs(s.start[2]) <= 0.5 && Math.abs(s.end[2]) <= 0.5)).toBe(true);
    expect(ink.every(s => Math.hypot(...s.end.map((v, i) => v - s.start[i])) < 2)).toBe(true);
  });

  it('拒绝非法时间与倍速', () => {
    const player = new Playback(plan);
    expect(() => player.advance(NaN)).toThrow();
    expect(() => player.advance(-1)).toThrow();
    expect(() => player.setSpeed(Infinity)).toThrow();
    expect(() => player.setSpeed(0)).toThrow();
  });
});
