// The first restoration space (the tile museum): 30 levels. 1-10 are the tutorial, one new thing each;
// 11-30 introduce the tools and climb in a saw-tooth (a hard level every few). docs/story-mode.md has the plan.
// Boards are drawn as 9 rows: '.' empty, '#' prefilled old tile, 'c' crack, 's' stone, 'g' gold.
// Regions are drawn the same way ('X' = part of the frame), always on the full 9x9 board.
import type { Cell } from '../types';
import type { Goal, LevelDef, ToolCounts } from './solo';

interface Draft {
  seed: number;
  track: number;
  pacer: number;
  coins: number;
  treasures?: number[];
  rewards?: number[];
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
    id, seed: d.seed, trackLength: d.track, pacerStep: d.pacer, startingCoins: d.coins,
    treasures: d.treasures ?? [], rewards: d.rewards ?? [], cells,
    region: d.region, regionOrigin: d.region ? [0, 0] : undefined,
    goals: d.goals, stars: d.stars, hard: d.hard, teach: d.teach, freeTools: d.free,
  };
}

const EMPTY = ['.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........'];

export const LEVELS: LevelDef[] = [
  // 1. buy a tile and place it
  level(1, { seed: 1101, track: 30, pacer: 2, coins: 20, goals: [{ type: 'fill_count', n: 20 }], stars: [35, 43], teach: 'place' }),
  // 2. an old, half-finished tile panel: fill the gaps
  level(2, {
    seed: 1202, track: 30, pacer: 2, coins: 10, rewards: [6, 12, 18], teach: 'filled',
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
    goals: [{ type: 'fill_board' }], stars: [28, 32],
  }),
  // 3. the gate frame: only this part matters
  level(3, {
    seed: 1303, track: 34, pacer: 2, coins: 12, teach: 'region',
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
    goals: [{ type: 'fill_region' }], stars: [50, 61],
  }),
  // 4. tiles cost coins: Advance when you are short
  level(4, {
    seed: 1404, track: 34, pacer: 3, coins: 4, teach: 'advance',
    goals: [{ type: 'fill_count', n: 12 }, { type: 'min_coins', n: 10 }], stars: [24, 30],
  }),
  // 5. cracked tiles at the museum door
  level(5, {
    seed: 1505, track: 30, pacer: 2, coins: 10, teach: 'crack',
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
    goals: [{ type: 'cover_cracks' }], stars: [28, 35],
  }),
  // 6. treasures on the time track
  level(6, {
    seed: 1606, track: 30, pacer: 2, coins: 6, treasures: [6, 14, 22, 30], teach: 'treasure',
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
    goals: [{ type: 'fill_region' }, { type: 'min_score', n: 24 }], stars: [34, 42],
  }),
  // 7. stones: work around them
  level(7, {
    seed: 1707, track: 30, pacer: 2, coins: 10, rewards: [6, 12, 18, 24], teach: 'stone',
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
    goals: [{ type: 'fill_board' }], stars: [31, 35],
  }),
  // 8. 1x1 gift tiles
  level(8, {
    seed: 1808, track: 40, pacer: 2, coins: 8, rewards: [5, 10, 15, 20], teach: 'reward',
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
    goals: [{ type: 'max_empty', max: 2 }], stars: [43, 48],
  }),
  // 9. gold cells pay a coin
  level(9, {
    seed: 1909, track: 34, pacer: 2, coins: 6, teach: 'gold',
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
    goals: [{ type: 'cover_cracks' }, { type: 'min_coins', n: 10 }], stars: [24, 30],
  }),
  // 10. the 7x7 square: the end of the tutorial
  level(10, {
    seed: 2010, track: 36, pacer: 2, coins: 8, rewards: [10, 20, 30], teach: 'bonus7',
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
    goals: [{ type: 'bonus7' }], stars: [55, 66],
  }),
  // 11. the chisel (and the coin bag before the level)
  level(11, {
    seed: 2111, track: 62, pacer: 2, coins: 8, rewards: [12], teach: 'chisel', free: { chisel: 1 },
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
    goals: [{ type: 'max_empty', max: 3 }], stars: [57, 63],
  }),
  // 12. the wheel: new offers
  level(12, {
    seed: 2212, track: 40, pacer: 2, coins: 8, treasures: [8, 20], rewards: [14], teach: 'wheel', free: { wheel: 1 },
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
    goals: [{ type: 'cover_cracks' }, { type: 'max_empty', max: 12 }], stars: [61, 68],
  }),
  // 13. the brush: a free 1x1 anywhere
  level(13, {
    seed: 2313, track: 40, pacer: 2, coins: 8, treasures: [10, 22], teach: 'brush', free: { brush: 1 },
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
    goals: [{ type: 'fill_region' }, { type: 'fill_count', n: 30 }], stars: [66, 80],
  }),
  // 14. hard: tight time, a full frame and few empties
  level(14, {
    seed: 9137, track: 26, pacer: 2, coins: 5, treasures: [6, 14, 22, 30], rewards: [10, 26], hard: 1,
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
    goals: [{ type: 'fill_region' }, { type: 'cover_cracks' }, { type: 'max_empty', max: 30 }], stars: [51, 57],
  }),
  level(15, {
    seed: 3115, track: 60, pacer: 2, coins: 8, treasures: [8, 18, 28], rewards: [12, 24],
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
    goals: [{ type: 'fill_count', n: 40 }, { type: 'max_empty', max: 14 }], stars: [67, 74],
  }),
  level(16, {
    seed: 3216, track: 40, pacer: 2, coins: 7, treasures: [7, 17, 27], rewards: [12],
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
    goals: [{ type: 'fill_region' }], stars: [62, 74],
  }),
  level(17, {
    seed: 3317, track: 50, pacer: 2, coins: 8, treasures: [8, 18], rewards: [6, 12, 18, 24],
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
    goals: [{ type: 'max_empty', max: 4 }], stars: [61, 68],
  }),
  level(18, {
    seed: 3418, track: 30, pacer: 2, coins: 6, treasures: [6, 14, 22, 30], rewards: [18],
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
    goals: [{ type: 'cover_cracks' }, { type: 'min_coins', n: 12 }], stars: [43, 53],
  }),
  // 19. hard
  level(19, {
    seed: 3519, track: 38, pacer: 2, coins: 5, treasures: [8, 16, 24], rewards: [12, 20], hard: 1,
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
    goals: [{ type: 'cover_cracks' }, { type: 'max_empty', max: 4 }], stars: [44, 49],
  }),
  level(20, {
    seed: 3620, track: 32, pacer: 3, coins: 6, treasures: [6, 15, 24, 32], rewards: [10, 20],
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
    goals: [{ type: 'fill_region' }, { type: 'min_score', n: 44 }], stars: [56, 67],
  }),
  level(21, {
    seed: 3721, track: 38, pacer: 2, coins: 8, treasures: [10, 20], rewards: [8, 14, 20, 26],
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
    goals: [{ type: 'max_empty', max: 6 }], stars: [66, 73],
  }),
  level(22, {
    seed: 3822, track: 42, pacer: 2, coins: 6, treasures: [6, 14, 22, 30], rewards: [12, 24],
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
    goals: [{ type: 'cover_cracks' }, { type: 'bonus7' }], stars: [91, 108],
  }),
  level(23, {
    seed: 3923, track: 38, pacer: 2, coins: 7, treasures: [8, 18, 26], rewards: [12],
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
    goals: [{ type: 'max_empty', max: 10 }, { type: 'min_coins', n: 8 }], stars: [70, 78],
  }),
  // 24. hard
  level(24, {
    seed: 4024, track: 58, pacer: 2, coins: 5, treasures: [8, 16, 24], rewards: [6, 14, 22], hard: 1,
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
    goals: [{ type: 'cover_cracks' }, { type: 'max_empty', max: 12 }], stars: [73, 81],
  }),
  level(25, {
    seed: 4125, track: 42, pacer: 2, coins: 8, treasures: [8, 16, 24], rewards: [12, 22],
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
    goals: [{ type: 'fill_region' }, { type: 'max_empty', max: 20 }], stars: [67, 74],
  }),
  level(26, {
    seed: 4226, track: 48, pacer: 3, coins: 6, treasures: [6, 14, 22, 30], rewards: [8, 16, 24, 30],
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
    goals: [{ type: 'bonus7' }, { type: 'min_coins', n: 6 }], stars: [88, 105],
  }),
  level(27, {
    seed: 4327, track: 62, pacer: 2, coins: 7, treasures: [7, 15, 23], rewards: [5, 10, 15, 20],
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
    goals: [{ type: 'max_empty', max: 4 }], stars: [63, 70],
  }),
  level(28, {
    seed: 4428, track: 40, pacer: 2, coins: 6, treasures: [6, 14, 22, 30], rewards: [10, 18, 26],
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
    goals: [{ type: 'fill_region' }, { type: 'cover_cracks' }, { type: 'max_empty', max: 16 }], stars: [87, 96],
  }),
  // 29. very hard
  level(29, {
    seed: 4529, track: 46, pacer: 2, coins: 5, treasures: [8, 16, 24], rewards: [6, 14, 22], hard: 2,
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
    goals: [{ type: 'cover_cracks' }, { type: 'bonus7' }, { type: 'max_empty', max: 8 }], stars: [82, 91],
  }),
  // 30. the opening party: an easy one
  level(30, {
    seed: 4630, track: 28, pacer: 2, coins: 12, treasures: [6, 14, 22, 30], rewards: [10, 20],
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
    goals: [{ type: 'fill_region' }], stars: [47, 57],
  }),
];

export const levelById = (id: number): LevelDef | undefined => LEVELS[id - 1];
export const LAST_LEVEL = LEVELS.length;
