import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

const THEME_PREFERENCES = {
  SYSTEM: 'system',
  LIGHT: 'light',
  DARK: 'dark',
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('lms_theme');
    return saved || THEME_PREFERENCES.SYSTEM;
  });

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const applyTheme = (themeValue) => {
      let effectiveTheme = themeValue;

      if (themeValue === THEME_PREFERENCES.SYSTEM) {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? THEME_PREFERENCES.DARK
          : THEME_PREFERENCES.LIGHT;
      }

      setIsDark(effectiveTheme === THEME_PREFERENCES.DARK);

      if (effectiveTheme === THEME_PREFERENCES.DARK) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme(theme);
    localStorage.setItem('lms_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      if (prev === THEME_PREFERENCES.LIGHT) return THEME_PREFERENCES.DARK;
      if (prev === THEME_PREFERENCES.DARK) return THEME_PREFERENCES.SYSTEM;
      return THEME_PREFERENCES.LIGHT;
    });
  };

  const setThemeMode = (mode) => {
    if (Object.values(THEME_PREFERENCES).includes(mode)) {
      setTheme(mode);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark,
        toggleTheme,
        setThemeMode,
        THEME_PREFERENCES,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
