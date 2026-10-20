import type { Point3, PenPhase } from '../process/pen';
import { tcpPose, type PenPlan } from '../robot/planner';

export type PlaybackState = 'ready' | 'playing' | 'paused' | 'completed';
export interface InkSegment { start: Point3; end: Point3; stroke: number }
export interface CompletedHole { index: number; tip: Point3; depthMm: number }
export interface PlaybackSnapshot {
  state: PlaybackState;
  time: number;
  progress: number;
  q: number[];
  tip: Point3;
  phase: PenPhase;
  ink: InkSegment[];
  drawnStrokes: number;
  holes: CompletedHole[];
}

export class Playback {
  private time = 0;
  private speed = 1;
  private state: PlaybackState = 'ready';
  private readonly tips: Point3[];
  readonly plan: PenPlan;

  constructor(plan: PenPlan) {
    if (plan.samples.length < 2 || !Number.isFinite(plan.duration) || plan.duration <= 0) throw new Error('轨迹无有效时长');
    this.plan = plan;
    this.tips = plan.samples.map(s => tcpPose(s.q, plan.penLengthMm));
  }

  play(): void {
    if (this.state === 'completed') this.reset();
    this.state = 'playing';
  }

  pause(): void {
    if (this.state === 'playing') this.state = 'paused';
  }

  setSpeed(value: number): void {
    if (!Number.isFinite(value) || value < 0.25 || value > 4) throw new Error('倍速应在 0.25～4 范围内');
    this.speed = value;
  }

  advance(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error('时间增量必须为非负有限数');
    if (this.state !== 'playing') return;
    this.time = Math.min(this.plan.duration, this.time + seconds * this.speed);
    if (this.plan.duration - this.time < 1e-9) {
      this.time = this.plan.duration;
      this.state = 'completed';
    }
  }

  reset(): void {
    this.time = 0;
    this.state = 'ready';
  }

  snapshot(): PlaybackSnapshot {
    const samples = this.plan.samples;
    let end = samples.findIndex(s => s.time > this.time + 1e-9);
    if (end === -1) end = samples.length;
    const previous = samples[Math.max(0, end - 1)];
    const next = samples[end];
    // 与样本搜索使用同一时间容差，避免分帧累加在边界多出零长度加工段。
    const elapsed = this.time - previous.time;
    const fraction = next && elapsed > 1e-9 ? Math.max(0, Math.min(1, elapsed / (next.time - previous.time))) : 0;
    const q = next ? previous.q.map((value, i) => value + (next.q[i] - value) * fraction) : [...previous.q];
    const tip = tcpPose(q, this.plan.penLengthMm);
    const ink: InkSegment[] = [];
    const append = (start: Point3, finish: Point3, stroke: number | null) => {
      if (stroke !== null && Math.abs(start[2] - this.plan.surfaceZmm) <= 0.5 && Math.abs(finish[2] - this.plan.surfaceZmm) <= 0.5) {
        ink.push({ start, end: finish, stroke });
      }
    };
    for (let i = 1; i < end; i++) append(this.tips[i - 1], this.tips[i], samples[i].ink);
    if (next && fraction > 0) append(this.tips[end - 1], tip, next.ink);
    // 只有孔底停留完整执行后才标记完成；位置和深度来自同一 FK 执行记录。
    const holes: CompletedHole[] = [];
    for (let i = 1; i < end; i++) {
      const sample = samples[i];
      if (sample.phase === 'dwell' && sample.hole !== undefined) {
        holes.push({ index: sample.hole, tip: this.tips[i], depthMm: this.plan.surfaceZmm - this.tips[i][2] });
      }
    }
    return {
      state: this.state, time: this.time, progress: this.time / this.plan.duration,
      q, tip, phase: next?.phase ?? previous.phase, ink,
      drawnStrokes: this.plan.config?.id === 'drill' ? holes.length : new Set(ink.map(s => s.stroke)).size,
      holes,
    };
  }
}
