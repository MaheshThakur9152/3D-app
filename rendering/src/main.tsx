/**
 * main.tsx
 * Entry point for Mahesh 3D React Application.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import './styles.scss';

const rootEl = document.getElementById('root');
if (rootEl) {
    const root = ReactDOM.createRoot(rootEl);
    root.render(<App />);
}
