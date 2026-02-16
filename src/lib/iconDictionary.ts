type IconKeywordRule = {
  emoji: string;
  keywords: string[];
};

const ICON_KEYWORD_RULES: IconKeywordRule[] = [
  { emoji: '🍽️', keywords: ['dinner', 'supper', 'restaurant'] },
  { emoji: '🥗', keywords: ['lunch', 'brunch', 'meal'] },
  { emoji: '🍻', keywords: ['beer', 'beers', 'brew', 'pub', 'bar'] },
  { emoji: '☕', keywords: ['coffee', 'cafe', 'espresso'] },
  { emoji: '✈️', keywords: ['trip', 'travel', 'flight', 'vacation', 'holiday'] },
  { emoji: '🎉', keywords: ['party', 'get together', 'get-together', 'hangout', 'hang out'] },
  { emoji: '🗓️', keywords: ['meeting', 'sync', 'planning', 'standup'] },
  { emoji: '🎬', keywords: ['movie', 'cinema', 'film'] },
  { emoji: '🏟️', keywords: ['sport', 'game', 'match', 'stadium'] },
];

export function suggestIconFromTitle(title: string): string | null {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return null;

  for (const rule of ICON_KEYWORD_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.emoji;
    }
  }

  return null;
}
