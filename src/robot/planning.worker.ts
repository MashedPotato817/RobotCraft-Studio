import { createPenJob, type PenSettings } from '../process/pen';
import { planPenJob } from './planner';

self.onmessage = (event: MessageEvent<{ version: number; settings: PenSettings }>) => {
  const { version, settings } = event.data;
  try {
    self.postMessage({ version, result: planPenJob(createPenJob(settings)) });
  } catch (error) {
    self.postMessage({ version, result: { ok: false, code: 'invalid-input', message: error instanceof Error ? error.message : '规划失败，请检查输入。' } });
  }
};
