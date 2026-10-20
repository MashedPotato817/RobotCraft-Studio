import { patterns, type PatternId } from '../design/patterns';
import { createPenJob, defaultPenSettings, drawingBoard, type PenJob, type PenTarget, type Point3 } from './pen';

export type ProcessId = 'pen' | 'drill' | 'cream';
export interface Workpiece {
  shape: 'box' | 'circle';
  centerXmm: number;
  centerYmm: number;
  widthMm: number;
  depthMm: number;
  topMm: number;
  bottomMm: number;
}
export interface ProcessConfig {
  id: ProcessId;
  name: string;
  tool: string;
  workpieceName: string;
  color: string;
  radiusMm: number;
  toolLengthMm: number;
  surfaceZmm: number;
  speedMmS: number;
  workpiece: Workpiece;
  holeSpacingMm: number;
  holeDepthMm: number;
  dwellSeconds: number;
  liftMm: number;
}

/** 所有长度为 mm。每种工艺的三个预设共用同一配置。 */
export const processes: Record<ProcessId, ProcessConfig> = {
  pen: {
    id: 'pen', name: '笔绘', tool: '绘图笔', workpieceName: '纸面', color: '#24465f', radiusMm: 0.32,
    toolLengthMm: 24, surfaceZmm: 0, speedMmS: 18,
    workpiece: { shape: 'box', ...drawingBoard, topMm: 0, bottomMm: -4.5 },
    holeSpacingMm: 0, holeDepthMm: 0, dwellSeconds: 0, liftMm: 8,
  },
  drill: {
    id: 'drill', name: '钻孔', tool: '钻头', workpieceName: '板材', color: '#403d37', radiusMm: 1.2,
    toolLengthMm: 30, surfaceZmm: 0, speedMmS: 8,
    workpiece: { shape: 'box', centerXmm: 110, centerYmm: 0, widthMm: 100, depthMm: 80, topMm: 0, bottomMm: -4 },
    holeSpacingMm: 5, holeDepthMm: 2, dwellSeconds: 0.2, liftMm: 8,
  },
  cream: {
    id: 'cream', name: '奶油裱花', tool: '圆口裱花嘴', workpieceName: '圆形蛋糕', color: '#f4b5bb', radiusMm: 1.2,
    toolLengthMm: 30, surfaceZmm: 9, speedMmS: 12,
    workpiece: { shape: 'circle', centerXmm: 110, centerYmm: 0, widthMm: 84, depthMm: 84, topMm: 8, bottomMm: -4 },
    holeSpacingMm: 0, holeDepthMm: 0, dwellSeconds: 0, liftMm: 8,
  },
};

export function createCraftJob(process: ProcessId, pattern: PatternId): PenJob {
  if (!Object.hasOwn(processes, process) || !Object.hasOwn(patterns, pattern)) throw new Error('请选择已有工艺和图案');
  const config = structuredClone(processes[process]);
  const settings = { ...defaultPenSettings, pattern, penLengthMm: config.toolLengthMm, surfaceZmm: config.surfaceZmm, drawSpeedMmS: config.speedMmS };
  if (process !== 'drill') return { ...createPenJob(settings), config };

  const holes: Point3[] = [];
  const addHole = (x: number, y: number) => {
    const point: Point3 = [settings.centerXmm + x * settings.sizeMm, settings.centerYmm + y * settings.sizeMm, config.surfaceZmm];
    if (!holes.some(p => Math.hypot(p[0] - point[0], p[1] - point[1]) < config.radiusMm * 2 + 0.5)) holes.push(point);
  };
  for (const stroke of patterns[pattern].strokes) {
    addHole(...stroke[0]);
    let remaining = config.holeSpacingMm;
    for (let i = 1; i < stroke.length; i++) {
      const a = stroke[i - 1], b = stroke[i];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]) * settings.sizeMm;
      let distance = remaining;
      while (distance <= length + 1e-9) {
        const t = distance / Math.max(length, 1e-9);
        addHole(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
        distance += config.holeSpacingMm;
      }
      remaining = distance - length;
    }
  }
  const targets: PenTarget[] = [];
  const append = (position: Point3, phase: PenTarget['phase'], hole?: number, holdSeconds?: number) => {
    const previous = targets.at(-1)?.position;
    const distance = previous ? Math.hypot(...position.map((v, i) => v - previous[i])) : 0;
    const count = Math.max(1, Math.ceil(distance));
    for (let step = 1; step <= count; step++) {
      const point = previous ? position.map((v, i) => previous[i] + (v - previous[i]) * step / count) as Point3 : [...position] as Point3;
      targets.push({ position: point, phase, ink: null, hole, holdSeconds });
    }
  };
  holes.forEach(([x, y, z], index) => {
    append([x, y, z + config.liftMm], 'travel');
    append([x, y, z], 'lower');
    append([x, y, z - config.holeDepthMm], 'drill', index);
    append([x, y, z - config.holeDepthMm], 'dwell', index, config.dwellSeconds);
    append([x, y, z + config.liftMm], 'lift');
  });
  return { settings, targets, config };
}
