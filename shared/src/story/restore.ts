// Restoration spaces: every won level gives one brick, bricks buy the steps of a space. Steps with options let
// the player pick a design (changeable later for free). docs/story-mode.md, "مرمت".

export interface RestoreStep {
  /** i18n: story.<space>.step.<id> and the art layer client/public/story/<space>/<id>[-<choice>].webp */
  id: string;
  cost: number;
  /** number of designs to choose from (0 = none) */
  choices: number;
  /** museum display slots this step opens */
  slots?: number;
}

export interface RestoreSpace { id: string; steps: RestoreStep[] }

export const SPACES: RestoreSpace[] = [
  {
    id: 'museum',
    steps: [
      { id: 'rubble', cost: 1, choices: 0 },
      { id: 'door', cost: 2, choices: 3 },
      { id: 'portal', cost: 3, choices: 3 },
      { id: 'lamps', cost: 2, choices: 3 },
      { id: 'hall1', cost: 4, choices: 0, slots: 2 },
      { id: 'pool', cost: 3, choices: 3 },
      { id: 'cases', cost: 3, choices: 0 },
      { id: 'ceiling', cost: 4, choices: 0 },
      { id: 'hall2', cost: 4, choices: 0, slots: 2 },
      { id: 'opening', cost: 4, choices: 0 },
    ],
  },
];

/** Progress in one space: how many steps are done, and the design picked for each step with options. */
export interface SpaceProgress { done: number; choices: Record<string, number> }
export type StepsProgress = Record<string, SpaceProgress>;

export const spaceById = (id: string) => SPACES.find((s) => s.id === id);
export const spaceTotal = (sp: RestoreSpace) => sp.steps.reduce((n, s) => n + s.cost, 0);
