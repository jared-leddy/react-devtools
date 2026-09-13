import { createRoot } from 'react-dom/client';
import { DevtoolsOverlay } from './App';

const CONTAINER_ID = '__react-devtools-overlay__';

export function mountDevtoolsOverlay(targetDocument: Document = document) {
    const existingContainer = targetDocument.getElementById(CONTAINER_ID);
    const container = existingContainer ?? targetDocument.createElement('div');

    if (!existingContainer) {
        container.id = CONTAINER_ID;
        container.setAttribute('data-react-devtools-overlay', 'true');
        targetDocument.body.appendChild(container);
    }

    const root = createRoot(container);
    root.render(<DevtoolsOverlay />);

    return { container, root };
}
