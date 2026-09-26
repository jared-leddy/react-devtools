import { createRoot } from 'react-dom/client';
import { Popup } from './Popup';
import { createDefaultPopupStatus } from './popupStatus';
import './style.css';

const root = document.getElementById('root');

if (root) {
    createRoot(root).render(<Popup status={createDefaultPopupStatus()} />);
}
