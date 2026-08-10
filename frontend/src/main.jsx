import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext';

document.documentElement.classList.remove('dark');
document.documentElement.style.colorScheme = 'light';
document.body?.classList.remove('dark');
document.body?.style.setProperty('color-scheme', 'light');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
