// The first restoration space (the tile museum): 30 levels. 1-10 are the tutorial, one new thing each;
// 11-30 introduce the tools and climb in a saw-tooth (a hard level every few). docs/story-mode.md has the plan.
// Levels 1-3 hide the deadline (STORY.SHOW_DAYS), so they get a long one; level 1 also hides the shards.
// Boards are drawn as 9 rows: '.' empty, '#' prefilled old tile, 'c' crack, 's' stone, 'g' gold.
// Regions are drawn the same way ('X' = part of the frame), always on the full 9x9 board.
import type { Cell } from '../types';
import type { Goal, LevelDef, ToolCounts } from './solo';

interface Draft {
  seed: number;
  days: number;
  shards: number;
  paydays?: number[];
  gifts?: number[];
  board?: string[];
  region?: string[];
  goals: Goal[];
  stars: [number, number];
  hard?: 1 | 2;
  teach?: string;
  free?: ToolCounts;
}

function level(id: number, d: Draft): LevelDef {
  const cells: Required<NonNullable<LevelDef['cells']>> = { filled: [], crack: [], stone: [], gold: [] };
  const key = { '#': 'filled', c: 'crack', s: 'stone', g: 'gold' } as const;
  (d.board ?? []).forEach((row, r) => [...row].forEach((ch, c) => {
    const k = key[ch as keyof typeof key];
    if (k) cells[k].push([r, c] as Cell);
  }));
  return {
    id, seed: d.seed, days: d.days, startingShards: d.shards,
    paydays: d.paydays ?? [], giftDays: d.gifts ?? [], cells,
    region: d.region, regionOrigin: d.region ? [0, 0] : undefined,
    goals: d.goals, stars: d.stars, hard: d.hard, teach: d.teach, freeTools: d.free,
  };
}

const EMPTY = ['.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........'];

export const LEVELS: LevelDef[] = [
  // 1. buy a tile and place it
  level(1, { seed: 1101, days: 200, shards: 60, goals: [{ type: 'fill_count', n: 20 }], stars: [54, 65], teach: 'place' }),
  // 2. an old, half-finished tile panel: fill the gaps
  level(2, {
    seed: 1202, days: 200, shards: 30, gifts: [6, 12, 18], teach: 'filled',
    board: [
      '#########',
      '##....###',
      '##....###',
      '#########',
      '###..####',
      '###..####',
      '###..####',
      '#########',
      '#########',
    ],
    goals: [{ type: 'fill_board' }], stars: [40, 45],
  }),
  // 3. the gate frame: only this part matters
  level(3, {
    seed: 1303, days: 200, shards: 40, teach: 'region',
    region: [
      '.........',
      '..XXXXX..',
      '.XXXXXXX.',
      '.XX...XX.',
      '.XX...XX.',
      '.XX...XX.',
      '.........',
      '.........',
      '.........',
    ],
    goals: [{ type: 'fill_region' }], stars: [59, 72],
  }),
  // 4. days, and work when you are short of shards
  level(4, {
    seed: 1404, days: 26, shards: 4, teach: 'work',
    goals: [{ type: 'fill_count', n: 12 }, { type: 'min_shards', n: 10 }], stars: [25, 31],
  }),
  // 5. cracked tiles at the museum door
  level(5, {
    seed: 1505, days: 22, shards: 10, teach: 'crack',
    board: [
      '.........',
      '.c.....c.',
      '.........',
      '...c.c...',
      '.........',
      '...c.c...',
      '.........',
      '.c.....c.',
      '.........',
    ],
    goals: [{ type: 'cover_cracks' }], stars: [32, 39],
  }),
  // 6. paydays
  level(6, {
    seed: 1606, days: 22, shards: 6, paydays: [6, 14, 22, 30], teach: 'payday',
    region: [
      '.........',
      '.........',
      '..XXXXX..',
      '..XXXXX..',
      '..XXXXX..',
      '.........',
      '.........',
      '.........',
      '.........',
    ],
    goals: [{ type: 'fill_region' }, { type: 'min_score', n: 24 }], stars: [32, 39],
  }),
  // 7. stones: work around them
  level(7, {
    seed: 1707, days: 26, shards: 10, gifts: [5, 10, 15, 20, 25, 30], teach: 'stone',
    board: [
      'sssssssss',
      'ssss.ssss',
      'sss...sss',
      'ss..#..ss',
      's..###..s',
      'ss..#..ss',
      'sss...sss',
      'ssss.ssss',
      'sssssssss',
    ],
    goals: [{ type: 'fill_board' }], stars: [30, 34],
  }),
  // 8. gift days and the 1x1 tile
  level(8, {
    seed: 1808, days: 24, shards: 8, gifts: [5, 10, 15, 20], teach: 'gift',
    board: [
      '####.####',
      '#...##..#',
      '#######.#',
      '#########',
      '###..##.#',
      '###..####',
      '###.#####',
      '##...####',
      '########.',
    ],
    goals: [{ type: 'max_empty', max: 2 }], stars: [35, 39],
  }),
  // 9. gold cells pay a shard
  level(9, {
    seed: 1909, days: 22, shards: 6, teach: 'gold',
    board: [
      '.........',
      '.g.....g.',
      '..c...c..',
      '.........',
      '....g....',
      '.........',
      '..c...c..',
      '.g.....g.',
      '.........',
    ],
    goals: [{ type: 'cover_cracks' }, { type: 'min_shards', n: 10 }], stars: [26, 32],
  }),
  // 10. the 7x7 square: the end of the tutorial
  level(10, {
    seed: 2010, days: 36, shards: 8, gifts: [10, 20, 30], teach: 'bonus7',
    board: [
      '.........',
      '.##...##.',
      '.#.....#.',
      '...###...',
      '...###...',
      '...###...',
      '.#.....#.',
      '.##...##.',
      '.........',
    ],
    region: [
      '.........',
      '.XXXXXXX.',
      '.XXXXXXX.',
      '.XXXXXXX.',
      '.XXXXXXX.',
      '.XXXXXXX.',
      '.XXXXXXX.',
      '.XXXXXXX.',
      '.........',
    ],
    goals: [{ type: 'bonus7' }], stars: [47, 57],
  }),
  // 11. the chisel (and the shard bag before the level)
  level(11, {
    seed: 2111, days: 34, shards: 8, gifts: [12], teach: 'chisel', free: { chisel: 1 },
    board: [
      '#########',
      '#.......#',
      '#.......#',
      '#..###..#',
      '#..###..#',
      '#.......#',
      '#.......#',
      '#########',
      '#########',
    ],
    goals: [{ type: 'max_empty', max: 3 }], stars: [39, 43],
  }),
  // 12. the wheel: new offers
  level(12, {
    seed: 2212, days: 42, shards: 8, paydays: [8, 20], gifts: [14], teach: 'wheel', free: { wheel: 1 },
    board: [
      '.........',
      '.c..#..c.',
      '....#....',
      '.c..#..c.',
      '####.####',
      '.c..#..c.',
      '....#....',
      '.c..#..c.',
      '.........',
    ],
    goals: [{ type: 'cover_cracks' }, { type: 'max_empty', max: 12 }], stars: [62, 69],
  }),
  // 13. the brush: a free 1x1 anywhere
  level(13, {
    seed: 2313, days: 58, shards: 8, paydays: [10, 22], teach: 'brush', free: { brush: 1 },
    board: [
      '#.#.#.#.#',
      '.........',
      '#.......#',
      '.........',
      '#.......#',
      '.........',
      '#.......#',
      '.........',
      '#.#.#.#.#',
    ],
    region: [
      '.X.X.X.X.',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.X.X.X.X.',
    ],
    goals: [{ type: 'fill_region' }, { type: 'fill_count', n: 30 }], stars: [80, 96],
  }),
  // 14. hard: tight time, a full frame and few empties
  level(14, {
    seed: 9137, days: 32, shards: 5, paydays: [6, 14, 22, 30], gifts: [10, 26], hard: 1,
    board: [
      '##......s',
      '###......',
      '..cc.....',
      '..c......',
      '....g....',
      '.........',
      '......cc.',
      '.......c.',
      's........',
    ],
    region: [
      '.........',
      '.........',
      '.........',
      '...XXX...',
      '..XXXXX..',
      '...XXX...',
      '.........',
      '.........',
      '.........',
    ],
    goals: [{ type: 'fill_region' }, { type: 'cover_cracks' }, { type: 'max_empty', max: 30 }], stars: [61, 68],
  }),
  level(15, {
    seed: 3115, days: 40, shards: 8, paydays: [8, 18, 28], gifts: [12, 24],
    board: [
      '.........',
      '.sssssss.',
      '.s.....s.',
      '.s.....s.',
      '.s..g..s.',
      '.s.....s.',
      '.s.....s.',
      '.sssssss.',
      '.........',
    ],
    goals: [{ type: 'fill_count', n: 40 }, { type: 'max_empty', max: 14 }], stars: [62, 69],
  }),
  level(16, {
    seed: 3216, days: 44, shards: 7, paydays: [7, 17, 27], gifts: [12],
    region: [
      '....X....',
      '...XXX...',
      '..XXXXX..',
      '.XXXXXXX.',
      'XXXXXXXXX',
      '.XXXXXXX.',
      '..XXXXX..',
      '...XXX...',
      '....X....',
    ],
    goals: [{ type: 'fill_region' }], stars: [61, 73],
  }),
  level(17, {
    seed: 3317, days: 34, shards: 8, paydays: [8, 18], gifts: [6, 12, 18, 24],
    board: [
      '###...###',
      '##.....##',
      '#...#...#',
      '...###...',
      '..##s##..',
      '...###...',
      '#...#...#',
      '##.....##',
      '###...###',
    ],
    goals: [{ type: 'max_empty', max: 4 }], stars: [51, 57],
  }),
  level(18, {
    seed: 3418, days: 26, shards: 6, paydays: [6, 14, 22, 30], gifts: [18],
    board: [
      'g.......g',
      '.c.....c.',
      '..c...c..',
      '...c.c...',
      '....g....',
      '...c.c...',
      '..c...c..',
      '.c.....c.',
      'g.......g',
    ],
    goals: [{ type: 'cover_cracks' }, { type: 'min_shards', n: 12 }], stars: [39, 47],
  }),
  // 19. hard
  level(19, {
    seed: 3519, days: 54, shards: 5, paydays: [8, 16, 24], gifts: [12, 20], hard: 1,
    board: [
      '#########',
      '#.......#',
      '#.c...c.#',
      '#...#...#',
      '#..###..#',
      '#...#...#',
      '#.c...c.#',
      '#.......#',
      '#########',
    ],
    goals: [{ type: 'cover_cracks' }, { type: 'max_empty', max: 4 }], stars: [57, 63],
  }),
  level(20, {
    seed: 3620, days: 32, shards: 6, paydays: [6, 15, 24, 32], gifts: [10, 20],
    region: [
      'XXXXXXXXX',
      'X.......X',
      'X.......X',
      'X.......X',
      'X.......X',
      'X.......X',
      'X.......X',
      'X.......X',
      'XXXXXXXXX',
    ],
    goals: [{ type: 'fill_region' }, { type: 'min_score', n: 44 }], stars: [74, 89],
  }),
  level(21, {
    seed: 3721, days: 48, shards: 8, paydays: [10, 20], gifts: [8, 14, 20, 26],
    board: [
      's.......s',
      '.........',
      '..#####..',
      '..#...#..',
      '..#.g.#..',
      '..#...#..',
      '..#####..',
      '.........',
      's.......s',
    ],
    goals: [{ type: 'max_empty', max: 6 }], stars: [62, 69],
  }),
  level(22, {
    seed: 3822, days: 48, shards: 6, paydays: [6, 14, 22, 30], gifts: [8, 16, 24, 32, 40],
    board: [
      '.........',
      '..c...c..',
      '.........',
      'c.......c',
      '.........',
      'c.......c',
      '.........',
      '..c...c..',
      '.........',
    ],
    goals: [{ type: 'cover_cracks' }, { type: 'bonus7' }], stars: [86, 103],
  }),
  level(23, {
    seed: 3923, days: 34, shards: 7, paydays: [8, 18, 26], gifts: [12],
    board: [
      '#.......#',
      '.#.....#.',
      '..#...#..',
      '...#.#...',
      '....g....',
      '...#.#...',
      '..#...#..',
      '.#.....#.',
      '#.......#',
    ],
    goals: [{ type: 'max_empty', max: 10 }, { type: 'min_shards', n: 8 }], stars: [68, 76],
  }),
  // 24. hard
  level(24, {
    seed: 4024, days: 34, shards: 5, paydays: [8, 16, 24], gifts: [6, 14, 22], hard: 1,
    board: [
      'ss.....ss',
      's.c...c.s',
      '.........',
      '...###...',
      '.c.#g#.c.',
      '...###...',
      '.........',
      's.c...c.s',
      'ss.....ss',
    ],
    goals: [{ type: 'cover_cracks' }, { type: 'max_empty', max: 12 }], stars: [63, 70],
  }),
  level(25, {
    seed: 4125, days: 40, shards: 8, paydays: [8, 16, 24], gifts: [12, 22],
    region: [
      '.........',
      '.XX...XX.',
      '.XX...XX.',
      '.........',
      '...XXX...',
      '.........',
      '.XX...XX.',
      '.XX...XX.',
      '.........',
    ],
    goals: [{ type: 'fill_region' }, { type: 'max_empty', max: 20 }], stars: [66, 73],
  }),
  level(26, {
    seed: 4226, days: 46, shards: 6, paydays: [6, 14, 22, 30], gifts: [8, 16, 24, 30],
    board: [
      '.........',
      '.g.....g.',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.g.....g.',
      '........s',
    ],
    goals: [{ type: 'bonus7' }, { type: 'min_shards', n: 6 }], stars: [85, 101],
  }),
  level(27, {
    seed: 4327, days: 28, shards: 7, paydays: [7, 15, 23], gifts: [5, 10, 15, 20],
    board: [
      '#########',
      '#...#...#',
      '#.c.#.c.#',
      '#...#...#',
      '####.####',
      '#...#...#',
      '#.c.#.c.#',
      '#...#...#',
      '#########',
    ],
    goals: [{ type: 'max_empty', max: 4 }], stars: [37, 41],
  }),
  level(28, {
    seed: 4428, days: 36, shards: 6, paydays: [6, 14, 22, 30], gifts: [10, 18, 26],
    board: [
      'c.......c',
      '.........',
      '..g...g..',
      '.........',
      '....c....',
      '.........',
      '..g...g..',
      '.........',
      'c.......c',
    ],
    region: [
      '.........',
      '.........',
      '.........',
      '...XXX...',
      '...XXX...',
      '...XXX...',
      '.........',
      '.........',
      '.........',
    ],
    goals: [{ type: 'fill_region' }, { type: 'cover_cracks' }, { type: 'max_empty', max: 16 }], stars: [91, 101],
  }),
  // 29. very hard
  level(29, {
    seed: 4529, days: 40, shards: 5, paydays: [8, 16, 24], gifts: [6, 14, 22], hard: 2,
    board: [
      '#.......#',
      '.........',
      '..c...c..',
      '.........',
      '....#....',
      '.........',
      '..c...c..',
      '.........',
      '#.......#',
    ],
    goals: [{ type: 'cover_cracks' }, { type: 'bonus7' }, { type: 'max_empty', max: 8 }], stars: [81, 89],
  }),
  // 30. the opening party: an easy one
  level(30, {
    seed: 4630, days: 24, shards: 12, paydays: [6, 14, 22, 30], gifts: [10, 20],
    board: EMPTY.map((r, i) => (i === 4 ? '....g....' : r)),
    region: [
      '.........',
      '.........',
      '.........',
      '.XXXXXXX.',
      '.XXXXXXX.',
      '.XXXXXXX.',
      '.........',
      '.........',
      '.........',
    ],
    goals: [{ type: 'fill_region' }], stars: [43, 53],
  }),
];

export const levelById = (id: number): LevelDef | undefined => LEVELS[id - 1];
export const LAST_LEVEL = LEVELS.length;
