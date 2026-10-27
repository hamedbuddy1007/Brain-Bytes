/**
 * Deterministically shuffles an array based on a participant seed (rollNumber).
 *
 * Benefits:
 * - Anti-cheating: Competitors at adjacent workstations have different question orders.
 * - Refresh-safe: A competitor who reloads their browser gets the identical question sequence.
 */
export function shuffleForParticipant<T>(items: T[], seedStr: string | undefined): T[] {
  if (!seedStr) return items;

  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  }

  const array = [...items];
  for (let i = array.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}
