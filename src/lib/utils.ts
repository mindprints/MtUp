// Pool of emojis for activity proposals
export const EMOJI_POOL = [
  '🍺', // Beers
  '☕', // Coffee
  '🍕', // Pizza/Lunch
  '🍽️', // Dinner
  '🎬', // Movies
  '🎮', // Games
  '⚽', // Sports
  '🎵', // Music/Concert
  '🎨', // Art/Museum
  '🏃', // Exercise
  '🏖️', // Beach
  '⛰️', // Hiking/Mountains
  '✈️', // Trip/Flight
  '🚗', // Road Trip
  '🏠', // House Party
  '🎉', // Party/Celebration
  '📚', // Book Club
  '🛍️', // Shopping
  '🌮', // Tacos/Mexican
  '🍜', // Ramen/Asian
  '🍷', // Wine
  '🎭', // Theater
  '🎪', // Event
  '🏊', // Swimming
  '🚴', // Biking
  '⛷️', // Skiing
  '🎳', // Bowling
  '🎯', // Darts
  '🎲', // Board Games
  '🌳', // Park/Outdoors
];

// Get a random emoji from the pool
export function getRandomEmoji(): string {
  return EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)];
}

// Get an emoji that hasn't been used yet (from active proposals)
export function getAvailableEmoji(usedEmojis: string[]): string {
  const available = EMOJI_POOL.filter((emoji) => !usedEmojis.includes(emoji));
  
  if (available.length === 0) {
    // If all emojis are used, just return a random one
    return getRandomEmoji();
  }
  
  return available[Math.floor(Math.random() * available.length)];
}

// Generate a unique ID
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
