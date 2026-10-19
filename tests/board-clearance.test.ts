import { describe, expect, it } from 'vitest';
import { armClearsBoard } from '../src/robot/board-clearance';

describe('画板几何间隙', () => {
  it('连杆两端在板外时仍能检出中段穿板', () => {
    expect(armClearsBoard([[60, 0, -20], [60, 0, 20]], 0)).toBe(false);
  });

  it('为关节外形与画板保留间隙', () => {
    expect(armClearsBoard([[100, 0, 5], [140, 0, 5]], 0)).toBe(false);
  });

  it('允许板面上方的连杆', () => {
    expect(armClearsBoard([[60, 0, 10], [140, 0, 10]], 0)).toBe(true);
  });

  it('不把画板范围以外的基座连杆当作穿板', () => {
    expect(armClearsBoard([[0, 0, 0], [20, 0, 30]], 0)).toBe(true);
  });
});
