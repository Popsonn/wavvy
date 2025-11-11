/**
 * Fisher-Yates shuffle algorithm for unbiased random array shuffling
 * More reliable than Array.sort(() => Math.random() - 0.5)
 * 
 * @param array - Array to shuffle
 * @returns New shuffled array (does not mutate original)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Generate randomized question order for anti-cheating
 * Returns an array of indices in random order
 * 
 * @param questionCount - Total number of questions
 * @returns Array of shuffled indices [0, 1, 2, ...] in random order
 * 
 * @example
 * generateQuestionOrder(5) // might return [2, 0, 4, 1, 3]
 */
export function generateQuestionOrder(questionCount: number): number[] {
  const indices = Array.from({ length: questionCount }, (_, i) => i);
  return shuffleArray(indices);
}