import { patterns, type PatternId } from '../design/patterns';
import type { ProcessConfig } from './craft';

export type Point3 = [number, number, number];
export type PenPhase = 'travel' | 'lower' | 'draw' | 'lift' | 'drill' | 'dwell';
export interface PenSettings {
  pattern: PatternId;
  sizeMm: number;
  centerXmm: number;
  centerYmm: number;
  surfaceZmm: number;
  penLengthMm: number;
  drawSpeedMmS: number;
}
export interface PenTarget {
  position: Point3;
  phase: PenPhase;
  /** 进入当前目标的加工段标识，用于出墨或挤出；null 表示不生成线条。 */
  ink: number | null;
  hole?: number;
  holdSeconds?: number;
}
export interface PenJob {
  settings: PenSettings;
  targets: PenTarget[];
  config?: ProcessConfig;
}

export const drawingBoard = {
  centerXmm: 110, centerYmm: 0, widthMm: 156, depthMm: 116,
  thicknessMm: 4, sheetGapMm: 0.5,
} as const;

export const defaultPenSettings: PenSettings = {
  pattern: 'robot', sizeMm: 44, centerXmm: 110, centerYmm: 0,
  surfaceZmm: 0, penLengthMm: 24, drawSpeedMmS: 18,
};

export function createPenJob(settings: PenSettings): PenJob {
  const limits: [keyof Omit<PenSettings, 'pattern'>, number, number][] = [
    ['sizeMm', 20, 60], ['centerXmm', 80, 140], ['centerYmm', -20, 20],
    ['surfaceZmm', 0, 70], ['penLengthMm', 12, 40], ['drawSpeedMmS', 5, 60],
  ];
  for (const [key, min, max] of limits) {
    if (!Number.isFinite(settings[key]) || settings[key] < min || settings[key] > max) {
      throw new Error(`${key} 应在 ${min}～${max} 范围内`);
    }
  }
  if (!Object.hasOwn(patterns, settings.pattern)) throw new Error('请选择已有图案');
  const targets: PenTarget[] = [];
  const append = (position: Point3, phase: PenPhase, ink: number | null) => {
    const previous = targets.at(-1)?.position;
    const distance = previous ? Math.hypot(...position.map((v, i) => v - previous[i])) : 0;
    const steps = Math.max(1, Math.ceil(distance / 1.0));
    for (let i = 1; i <= steps; i++) {
      const point = previous ? position.map((v, axis) => previous[axis] + (v - previous[axis]) * i / steps) as Point3 : [...position] as Point3;
      targets.push({ position: point, phase, ink });
    }
  };
  patterns[settings.pattern].strokes.forEach((stroke, index) => {
    const points = stroke.map(([x, y]): Point3 => [
      settings.centerXmm + x * settings.sizeMm,
      settings.centerYmm + y * settings.sizeMm,
      settings.surfaceZmm,
    ]);
    const first = points[0];
    append([first[0], first[1], first[2] + 8], 'travel', null);
    append(first, 'lower', null);
    points.slice(1).forEach(point => append(point, 'draw', index));
    const last = points.at(-1)!;
    append([last[0], last[1], last[2] + 8], 'lift', null);
  });
  return { settings: { ...settings }, targets };
}
