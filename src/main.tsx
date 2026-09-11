import './polyfills';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LivePriceProvider } from './components/LivePriceContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LivePriceProvider>
      <App />
    </LivePriceProvider>
  </StrictMode>,
);
