export type Point2 = [number, number];
export type PatternId = 'robot' | 'zhong' | 'flower';
export interface Pattern {
  id: PatternId;
  name: string;
  description: string;
  strokes: Point2[][];
}

const glyphs: Record<string, Point2[][]> = {
  R: [[[0, 0], [0, 1], [0.65, 1], [0.8, 0.8], [0.65, 0.55], [0, 0.55]], [[0.35, 0.55], [0.8, 0]]],
  O: [[[0.15, 0], [0, 0.2], [0, 0.8], [0.15, 1], [0.65, 1], [0.8, 0.8], [0.8, 0.2], [0.65, 0], [0.15, 0]]],
  B: [[[0, 0], [0, 1], [0.6, 1], [0.8, 0.8], [0.6, 0.55], [0, 0.55]], [[0.6, 0.55], [0.8, 0.3], [0.65, 0], [0, 0]]],
  T: [[[0, 1], [0.8, 1]], [[0.4, 1], [0.4, 0]]],
};

const robotStrokes = [...'ROBOT'].flatMap((letter, index) =>
  glyphs[letter].map(stroke => stroke.map(([x, y]): Point2 => [(x + index * 1.05) / 5 - 0.5, (y - 0.5) / 5]))
);

export const patterns: Record<PatternId, Pattern> = {
  robot: { id: 'robot', name: 'ROBOT 字样', description: '多笔画字母 · 观察抬笔与转移', strokes: robotStrokes },
  zhong: {
    id: 'zhong', name: '汉字「中」', description: '四笔书写 · 观察笔画衔接',
    strokes: [
      [[-0.32, 0.26], [-0.32, -0.14]],
      [[-0.32, 0.26], [0.32, 0.26], [0.32, -0.14]],
      [[0.32, -0.14], [-0.32, -0.14]],
      [[0, 0.5], [0, -0.5]],
    ],
  },
  flower: {
    id: 'flower', name: '连续花形', description: '闭合曲线 · 观察平滑跟随',
    strokes: [Array.from({ length: 121 }, (_, i): Point2 => {
      const angle = i / 120 * Math.PI * 2;
      const radius = 0.37 + 0.12 * Math.cos(5 * angle);
      return [radius * Math.cos(angle), radius * Math.sin(angle)];
    })],
  },
};
