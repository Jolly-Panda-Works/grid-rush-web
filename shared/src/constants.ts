// Values come from 02_Core_Rules.md (CONFIRMED) unless marked ASSUMPTION.
export const BOARD_SIZE = 9;
export const STARTING_COINS = 5;
export const STARTING_POSITION = 0;
export const ADVANCE_COIN_RATE = 1;
export const SPECIAL_7X7_BONUS = 7;
export const SPECIAL_AREA = 7;
export const EMPTY_CELL_PENALTY = 2;
export const OFFER_SIZE = 3;

// ASSUMPTION: TRACK_LENGTH is a balance parameter in the docs (no fixed value). 90 chosen after bot self-play:
// 54 ended games in ~15 actions (Advance chain) with boards ~70% empty.
export const TRACK_LENGTH = 90;
// ASSUMPTION: positions of the 9 treasure spaces and 5 reward 1x1 spaces (distinct cells).
export const TREASURE_POSITIONS = [9, 18, 27, 36, 45, 54, 63, 72, 81];
export const REWARD_POSITIONS = [10, 26, 43, 61, 78];
// ASSUMPTION: engraved coins on the 1x1 reward tile.
export const REWARD_ENGRAVED = 0;

// Operational values (not game rules)
export const TURN_SECONDS = 60;
export const MATCH_WAIT_MS = 7000;
