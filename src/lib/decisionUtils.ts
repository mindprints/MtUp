import type { DecisionOption, DecisionVote } from '@/types';

export function computeFirstChoiceCounts(
  options: DecisionOption[],
  votes: DecisionVote[]
): Map<string, number> {
  const counts = new Map<string, number>();
  options.forEach((option) => counts.set(option.id, 0));

  votes.forEach((vote) => {
    const firstChoice = vote.rankedOptionIds?.[0];
    if (!firstChoice) return;
    if (!counts.has(firstChoice)) return;
    counts.set(firstChoice, (counts.get(firstChoice) || 0) + 1);
  });

  return counts;
}

export function computeRankedScores(
  options: DecisionOption[],
  votes: DecisionVote[]
): Map<string, number> {
  const scores = new Map<string, number>();
  const optionIds = new Set(options.map((option) => option.id));
  options.forEach((option) => scores.set(option.id, 0));

  votes.forEach((vote) => {
    const ranking = vote.rankedOptionIds || [];
    const total = ranking.length;

    ranking.forEach((optionId, index) => {
      if (!optionIds.has(optionId)) return;
      // Borda-style weighting: higher rank gets higher points.
      const points = total - index;
      scores.set(optionId, (scores.get(optionId) || 0) + points);
    });
  });

  return scores;
}

export function getTopCandidates(
  options: DecisionOption[],
  rankedScores: Map<string, number>,
  firstChoiceCounts: Map<string, number>,
  limit = 3
): Array<{ option: DecisionOption; score: number; firstChoiceCount: number }> {
  return options
    .map((option) => ({
      option,
      score: rankedScores.get(option.id) || 0,
      firstChoiceCount: firstChoiceCounts.get(option.id) || 0,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.firstChoiceCount - a.firstChoiceCount;
    })
    .slice(0, limit);
}
