import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { VitePlaygroundApp } from './VitePlaygroundApp';
import './style.css';

const root = document.getElementById('root');

if (!root) {
    throw new Error('Vite playground root element was not found.');
}

createRoot(root).render(
    <StrictMode>
        <VitePlaygroundApp />
    </StrictMode>
);
