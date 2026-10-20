import { patterns, type PatternId } from '../design/patterns';
import { createPenJob, defaultPenSettings, drawingBoard, type PenJob } from './pen';

export type ProcessId = 'pen' | 'cream';
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
  liftMm: number;
}

/** 所有长度为 mm。每种工艺的三个预设共用同一配置。 */
export const processes: Record<ProcessId, ProcessConfig> = {
  pen: {
    id: 'pen', name: '笔绘', tool: '绘图笔', workpieceName: '纸面', color: '#24465f', radiusMm: 0.32,
    toolLengthMm: 24, surfaceZmm: 0, speedMmS: 18,
    workpiece: { shape: 'box', ...drawingBoard, topMm: 0, bottomMm: -4.5 },
    liftMm: 8,
  },
  cream: {
    id: 'cream', name: '奶油裱花', tool: '圆口裱花嘴', workpieceName: '圆形蛋糕', color: '#f4b5bb', radiusMm: 1.2,
    toolLengthMm: 30, surfaceZmm: 9, speedMmS: 12,
    workpiece: { shape: 'circle', centerXmm: 110, centerYmm: 0, widthMm: 84, depthMm: 84, topMm: 8, bottomMm: -4 },
    liftMm: 8,
  },
};

export function createCraftJob(process: ProcessId, pattern: PatternId): PenJob {
  if (!Object.hasOwn(processes, process) || !Object.hasOwn(patterns, pattern)) throw new Error('请选择已有工艺和图案');
  const config = structuredClone(processes[process]);
  const settings = { ...defaultPenSettings, pattern, penLengthMm: config.toolLengthMm, surfaceZmm: config.surfaceZmm, drawSpeedMmS: config.speedMmS };
  return { ...createPenJob(settings), config };
}
