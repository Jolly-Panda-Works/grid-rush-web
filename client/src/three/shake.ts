/** Camera shake by decaying "trauma" (0..1). Offset = trauma², so small events barely move the view and big ones punch.
 *  Only the camera moves (never the boards), and it always settles back to rest. */
export const shake = { trauma: 0 };

/** Feedback tiers: keep juice proportional to how important the event is. */
export const TRAUMA = { small: 0.18, medium: 0.32, large: 0.6 } as const;

export function addTrauma(amount: number) { shake.trauma = Math.min(1, shake.trauma + amount); }
