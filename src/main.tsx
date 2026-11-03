import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { installFetchGuard } from './shared/services/api';
import { ErrorBoundary } from './shared/components/ErrorBoundary';
import './index.css';

// Must run before any screen makes a request (see shared/services/api.ts).
installFetchGuard();

// Promise failures nobody handled are logged (they must not disappear silently).
window.addEventListener('unhandledrejection', (event) => console.error('[ui] Unhandled promise rejection:', event.reason));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
