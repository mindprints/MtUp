type IconKeywordRule = {
  emoji: string;
  keywords: string[];
};

// Priority-ordered keyword mapping. First match wins.
export const ICON_KEYWORD_RULES: IconKeywordRule[] = [
  { emoji: '☕', keywords: ['coffee', 'cafe', 'café', 'fika', 'espresso', 'latte', 'kapuc', 'cappuccino', 'te', 'tea', 'matcha', 'bageri', 'bakery', 'pastry', 'kanelbulle'] },
  { emoji: '🍺', keywords: ['beer', 'beers', 'brew', 'brewery', 'pub', 'bar', 'öl', 'bira', 'afterwork', 'aw'] },
  { emoji: '🍷', keywords: ['wine', 'vin', 'vins', 'winery', 'tasting', 'provning', 'vinprovning'] },
  { emoji: '🍸', keywords: ['cocktail', 'cocktails', 'martini', 'negroni', 'drink', 'drinks', 'mocktail'] },

  { emoji: '🍽️', keywords: ['dinner', 'middag', 'restaurant', 'restaurang', 'fine dining', 'reservation', 'book a table'] },
  { emoji: '🍕', keywords: ['pizza', 'pizzeria', 'slice'] },
  { emoji: '🍔', keywords: ['burger', 'burgers', 'hamburger'] },
  { emoji: '🥗', keywords: ['salad', 'vegan', 'vegetarian', 'veg', 'poke', 'healthy', 'häls', 'grön', 'lunch', 'brunch'] },
  { emoji: '🌮', keywords: ['taco', 'tacos', 'mexican', 'mexik', 'burrito', 'quesadilla', 'taqueria'] },
  { emoji: '🍜', keywords: ['ramen', 'noodle', 'noodles', 'pho', 'udon', 'soba', 'dumpling', 'dumplings', 'dim sum', 'asian', 'korean', 'thai', 'sushi', 'bibimbap'] },

  { emoji: '🎨', keywords: ['museum', 'art', 'gallery', 'exhibition', 'vernissage', 'utställning', 'konst', 'galleri'] },
  { emoji: '🎭', keywords: ['theater', 'theatre', 'play', 'musical', 'opera', 'dramaten', 'föreställning', 'teater'] },
  { emoji: '🎬', keywords: ['movie', 'cinema', 'film', 'screening', 'premiere', 'bio', 'imax'] },
  { emoji: '🎵', keywords: ['concert', 'gig', 'live music', 'music', 'dj', 'club', 'festival', 'spelning', 'konsert'] },
  { emoji: '🎤', keywords: ['lecture', 'talk', 'keynote', 'seminar', 'panel', 'fireside', 'föreläsning', 'seminarium', 'panelsamtal'] },
  { emoji: '📚', keywords: ['book club', 'reading', 'author talk', 'bokcirkel', 'bokklubb', 'bookstore', 'antikvariat'] },

  { emoji: '🎉', keywords: ['party', 'birthday', 'celebration', 'celebrate', 'fest', 'kalas', 'bröllop', 'wedding', 'anniversary', 'get together', 'get-together', 'hangout', 'hang out'] },
  { emoji: '🏠', keywords: ['house party', 'home party', 'at my place', 'at your place', 'hos mig', 'hos dig', 'lägenhet', 'apartment'] },
  { emoji: '🤝', keywords: ['meetup', 'networking', 'mingle', 'after work', 'community', 'träff', 'mingel', 'nätverk', 'meeting', 'sync', 'planning', 'standup'] },

  { emoji: '🎮', keywords: ['gaming', 'videogame', 'video game', 'lan', 'esports', 'e-sport'] },
  { emoji: '🎲', keywords: ['board game', 'boardgames', 'board games', 'brädspel', 'dnd', 'd&d', 'roleplay', 'rpg', 'cards', 'card game', 'poker'] },
  { emoji: '🎯', keywords: ['darts', 'dart'] },
  { emoji: '🎳', keywords: ['bowling', 'bowl'] },
  { emoji: '🧩', keywords: ['quiz', 'trivia', 'pub quiz', 'quiz night', 'frågesport'] },

  { emoji: '⚽', keywords: ['sports', 'sporting event', 'match', 'game', 'football', 'soccer', 'fotboll', 'premier league', 'allsvenskan', 'stadium'] },
  { emoji: '🏃', keywords: ['run', 'running', 'jog', 'jogging', 'gym', 'workout', 'training', 'träning', 'yoga', 'pilates', 'crossfit'] },
  { emoji: '🚴', keywords: ['bike', 'biking', 'cycle', 'cycling', 'cykla', 'cykling'] },
  { emoji: '🏊', keywords: ['swim', 'swimming', 'pool', 'simma', 'simning', 'bastu', 'sauna', 'spa'] },
  { emoji: '⛷️', keywords: ['ski', 'skiing', 'skidor', 'snowboard', 'slopes', 'piste'] },

  { emoji: '🌳', keywords: ['park', 'outdoors', 'outdoor', 'picnic', 'nature', 'skog', 'skogspromenad', 'promenade', 'walk', 'walking', 'hike light', 'stroll'] },
  { emoji: '⛰️', keywords: ['hike', 'hiking', 'mountain', 'mountains', 'trail', 'trek', 'fjäll', 'vandring'] },
  { emoji: '🏖️', keywords: ['beach', 'sun', 'swim spot', 'sand', 'badplats', 'strand'] },

  { emoji: '✈️', keywords: ['flight', 'fly', 'airport', 'plane', 'trip', 'travel', 'resa', 'semester', 'vacation', 'weekend away', 'holiday'] },
  { emoji: '🚗', keywords: ['road trip', 'drive', 'driving', 'car', 'ride', 'samåk', 'roadtrip'] },
  { emoji: '🚆', keywords: ['train', 'tåg', 'rail', 'pendeltåg', 'sj', 'metro', 'tunnelbana', 'subway'] },

  { emoji: '🎪', keywords: ['event', 'happening', 'activity', 'aktivit', 'plan', "let's do", 'let’s do'] },
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
