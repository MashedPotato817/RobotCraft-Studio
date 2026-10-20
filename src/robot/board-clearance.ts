import { drawingBoard, type Point3 } from '../process/pen';
import type { Workpiece } from '../process/craft';

/** 连杆与关节采用半径 4.4 mm 的保守包络，并在画板外额外预留 2 mm。 */
export function armClearsBoard(points: Point3[], surfaceZmm: number, workpiece?: Workpiece): boolean {
  const bounds = workpiece ?? { ...drawingBoard, topMm: surfaceZmm, bottomMm: surfaceZmm - drawingBoard.sheetGapMm - drawingBoard.thicknessMm };
  const padding = 4.4 + 2;
  const minimum = [
    bounds.centerXmm - bounds.widthMm / 2 - padding,
    bounds.centerYmm - bounds.depthMm / 2 - padding,
    bounds.bottomMm - padding,
  ];
  const maximum = [
    bounds.centerXmm + bounds.widthMm / 2 + padding,
    bounds.centerYmm + bounds.depthMm / 2 + padding,
    bounds.topMm + padding,
  ];
  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1];
    const end = points[i];
    let enter = 0;
    let exit = 1;
    for (let axis = 0; axis < 3; axis++) {
      const delta = end[axis] - start[axis];
      if (Math.abs(delta) < 1e-10) {
        if (start[axis] < minimum[axis] || start[axis] > maximum[axis]) { enter = 2; break; }
      } else {
        const a = (minimum[axis] - start[axis]) / delta;
        const b = (maximum[axis] - start[axis]) / delta;
        enter = Math.max(enter, Math.min(a, b));
        exit = Math.min(exit, Math.max(a, b));
      }
      if (enter > exit) break;
    }
    if (enter <= exit) return false;
  }
  return true;
}
