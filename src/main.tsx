import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './table.css';
import './games.css';
import './games2.css';
import { initSound } from './ui/sound';
import { initSettings } from './theme/settings';

initSettings();
initSound();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
