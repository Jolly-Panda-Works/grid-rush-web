// Values come from 02_Core_Rules.md (CONFIRMED) unless marked ASSUMPTION.
export const BOARD_SIZE = 9;
export const STARTING_COINS = 5;
export const STARTING_POSITION = 0;
export const ADVANCE_COIN_RATE = 1;
export const SPECIAL_7X7_BONUS = 7;
export const SPECIAL_AREA = 7;
export const EMPTY_CELL_PENALTY = 2;
export const OFFER_SIZE = 3;

// ASSUMPTION: TRACK_LENGTH is a balance parameter in the docs (no fixed value).
// With the v0.4 Advance rule (move to opponent+1), bot self-play at 54 gives ~53 actions/game and ~88% filled boards.
export const TRACK_LENGTH = 54;
// ASSUMPTION: positions of the 9 treasure spaces and 5 reward 1x1 spaces (distinct cells).
export const TREASURE_POSITIONS = [5, 11, 16, 22, 27, 32, 38, 43, 49];
export const REWARD_POSITIONS = [6, 17, 26, 36, 47];
// ASSUMPTION: engraved coins on the 1x1 reward tile.
export const REWARD_ENGRAVED = 0;

// Operational values (not game rules)
export const TURN_SECONDS = 60;
export const MATCH_WAIT_MS = 7000;
