import { createCraftJob, type ProcessId } from '../process/craft';
import type { PatternId } from '../design/patterns';
import { planPenJob } from './planner';

self.onmessage = (event: MessageEvent<{ version: number; process: ProcessId; pattern: PatternId }>) => {
  const { version, process, pattern } = event.data;
  try {
    self.postMessage({ version, result: planPenJob(createCraftJob(process, pattern)) });
  } catch (error) {
    self.postMessage({ version, result: { ok: false, code: 'invalid-input', message: error instanceof Error ? error.message : '规划失败，请检查输入。' } });
  }
};
