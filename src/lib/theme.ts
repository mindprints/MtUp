export const THEME_STORAGE_KEY = 'schedule-app-theme';

export function getStoredThemeIsDark(): boolean {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
}

export function applyTheme(isDarkMode: boolean): void {
  document.documentElement.classList.toggle('dark', isDarkMode);
  localStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? 'dark' : 'light');
}
