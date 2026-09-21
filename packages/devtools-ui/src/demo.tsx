import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { UIShowcase } from './demo/UIShowcase';
import './style.css';

const root = document.getElementById('root');

if (root) {
    createRoot(root).render(
        <StrictMode>
            <UIShowcase />
        </StrictMode>
    );
}
