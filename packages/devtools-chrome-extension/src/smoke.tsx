import { createRoot } from 'react-dom/client';
import { Popup } from './Popup';
import './style.css';

const root = document.getElementById('root');

if (root) {
    createRoot(root).render(
        <div className="dt-extension-smoke">
            <Popup
                status={{
                    badge: 'ready',
                    build: {
                        channel: 'dev',
                        version: '0.0.10'
                    },
                    docs: [
                        {
                            href: 'https://react.dev/learn/react-developer-tools',
                            label: 'React DevTools docs'
                        },
                        {
                            href: 'https://github.com/jared-leddy/react-devtools/issues',
                            label: 'Troubleshooting'
                        }
                    ],
                    inspectedUrl: 'http://localhost/react-smoke',
                    panelAvailable: true,
                    reactStatus: 'detected'
                }}
            />
            <section
                aria-label="React root tree"
                className="dt-extension-smoke__tree"
            >
                <h2>Root tree</h2>
                <ol>
                    <li>App</li>
                    <li>SmokeFixture</li>
                </ol>
            </section>
        </div>
    );
}
