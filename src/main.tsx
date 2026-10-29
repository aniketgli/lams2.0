import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { installFetchGuard } from './shared/services/api';
import './index.css';

// Must run before any screen makes a request (see shared/services/api.ts).
installFetchGuard();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
