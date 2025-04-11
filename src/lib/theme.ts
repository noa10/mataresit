// Initialize theme based on user preference
export function initializeTheme() {
  // On page load or when changing themes, best to add inline in `head` to avoid FOUC
  if (localStorage.theme === 'dark' || 
      (!('theme' in localStorage) && 
       window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// Function to toggle between light and dark mode
export function toggleTheme() {
  const isDarkMode = document.documentElement.classList.contains('dark');
  if (isDarkMode) {
    document.documentElement.classList.remove('dark');
    localStorage.theme = 'light';
  } else {
    document.documentElement.classList.add('dark');
    localStorage.theme = 'dark';
  }
  // Optional: Dispatch a custom event if components need to react directly
  // window.dispatchEvent(new CustomEvent('themeChanged'));
}
