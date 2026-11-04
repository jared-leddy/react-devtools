import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { createRoot as mountRoot } from 'react-dom/client';
function TargetCard({ portal = false }: { portal?: boolean }) {
    const [clicks, setClicks] = useState(0);
    return (
        <button
            id={portal ? 'portal-target' : 'pick-target'}
            onClick={() => setClicks((n) => n + 1)}
        >
            <span>
                {portal ? 'Portal' : 'Nested'} target {clicks}
            </span>
        </button>
    );
}
function FrameCard({ target }: { target: Element }) {
    return createPortal(
        <button id="frame-target">
            <span>Frame portal</span>
        </button>,
        target
    );
}
function PickerApp() {
    const [frame, setFrame] = useState<Element | null>(null);
    useEffect(() => {
        const node = document.querySelector<HTMLIFrameElement>('#same-frame')!;
        const update = () =>
            setFrame(
                node.contentDocument?.querySelector('#frame-portal') ?? null
            );
        update();
        node.addEventListener('load', update);
        return () => node.removeEventListener('load', update);
    }, []);
    return (
        <main>
            <h1>R09 actual page actions</h1>
            <TargetCard />
            {createPortal(
                <TargetCard portal />,
                document.getElementById('portal')!
            )}
            {frame ? <FrameCard target={frame} /> : null}
            <div style={{ height: 1600 }}>Scroll fixture</div>
            <p id="end">End</p>
        </main>
    );
}
mountRoot(document.getElementById('app')!).render(<PickerApp />);
