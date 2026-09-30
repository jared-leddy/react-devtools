import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

const STRESS_NODE_COUNT = 180;

export function MultiRootStressPlayground() {
    const [dynamicRootIds, setDynamicRootIds] = useState([1, 2]);
    const [nextRootId, setNextRootId] = useState(3);
    const [portalHost, setPortalHost] = useState<HTMLDivElement | null>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const iframeRootRef = useRef<Root | null>(null);

    useEffect(() => {
        const iframe = iframeRef.current;
        const document = iframe?.contentDocument;
        const mountTarget = document?.getElementById('iframe-root');

        if (!mountTarget) {
            return undefined;
        }

        const iframeRoot = createRoot(mountTarget);
        iframeRoot.render(
            <RootSurface
                id="iframe"
                label="Iframe root"
                subtitle="Mounted into an iframe document"
            />
        );
        iframeRootRef.current = iframeRoot;

        return () => {
            deferRootUnmount(iframeRoot);
            iframeRootRef.current = null;
        };
    }, []);

    const stressNodes = useMemo(
        () =>
            Array.from({ length: STRESS_NODE_COUNT }, (_, index) => ({
                depth: index % 6,
                id: index + 1
            })),
        []
    );

    return (
        <section aria-labelledby="multi-root-stress-heading">
            <h2 id="multi-root-stress-heading">
                Multi-root, portal, and stress fixtures
            </h2>
            <div className="stress-toolbar">
                <button
                    onClick={() => {
                        setDynamicRootIds((ids) => [...ids, nextRootId]);
                        setNextRootId((id) => id + 1);
                    }}
                >
                    Add root
                </button>
                <button
                    disabled={dynamicRootIds.length === 0}
                    onClick={() => {
                        setDynamicRootIds((ids) => ids.slice(0, -1));
                    }}
                >
                    Remove root
                </button>
                <p data-testid="dynamic-root-count">
                    {dynamicRootIds.length} dynamic roots mounted
                </p>
            </div>
            <div className="stress-layout">
                <article className="card">
                    <h3>multiple React roots</h3>
                    <div className="root-grid" data-testid="dynamic-root-hosts">
                        {dynamicRootIds.map((id) => (
                            <DynamicRootHost id={id} key={id} />
                        ))}
                    </div>
                </article>
                <article className="card">
                    <h3>portal target</h3>
                    <div
                        className="portal-target"
                        data-testid="portal-target"
                        ref={setPortalHost}
                    />
                    {portalHost
                        ? createPortal(
                              <PortalFixture>
                                  Portal child rendered outside the owner tree
                              </PortalFixture>,
                              portalHost
                          )
                        : null}
                </article>
                <article className="card">
                    <h3>iframe root</h3>
                    <iframe
                        className="iframe-root-fixture"
                        data-testid="iframe-root-frame"
                        ref={iframeRef}
                        srcDoc="<main id='iframe-root'></main>"
                        title="Iframe React root fixture"
                    />
                </article>
            </div>
            <article className="card stress-tree-card">
                <h3>large tree fixture</h3>
                <p>
                    Rendering{' '}
                    <strong data-testid="stress-node-count">
                        {stressNodes.length}
                    </strong>{' '}
                    nodes for virtualization and high-performance mode checks.
                </p>
                <div className="stress-tree" data-testid="stress-tree">
                    {stressNodes.map((node) => (
                        <StressTreeNode
                            depth={node.depth}
                            id={node.id}
                            key={node.id}
                        />
                    ))}
                </div>
            </article>
        </section>
    );
}

function DynamicRootHost({ id }: { id: number }) {
    const hostRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const host = hostRef.current;

        if (!host) {
            return undefined;
        }

        const root = createRoot(host);
        root.render(
            <RootSurface
                id={String(id)}
                label={`Dynamic root ${id}`}
                subtitle="Mounted with createRoot"
            />
        );

        return () => {
            deferRootUnmount(root);
        };
    }, [id]);

    return (
        <div
            aria-label={`Dynamic root ${id} host`}
            className="dynamic-root-host"
            data-testid="dynamic-root-host"
            ref={hostRef}
        />
    );
}

function RootSurface({
    id,
    label,
    subtitle
}: {
    id: string;
    label: string;
    subtitle: string;
}) {
    return (
        <div className="root-surface" data-testid="dynamic-root-content">
            <strong>{label}</strong>
            <span>{subtitle}</span>
            <small>root:{id}</small>
        </div>
    );
}

function PortalFixture({ children }: { children: ReactNode }) {
    return (
        <div className="portal-child" data-testid="portal-child">
            {children}
        </div>
    );
}

function StressTreeNode({ depth, id }: { depth: number; id: number }) {
    return (
        <div
            className="stress-node"
            data-depth={depth}
            data-testid="stress-tree-node"
            style={{ paddingLeft: `${depth * 10}px` }}
        >
            <span>Node {id}</span>
            <small>depth {depth}</small>
        </div>
    );
}

function deferRootUnmount(root: Root): void {
    if (
        typeof globalThis === 'object' &&
        (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
            .IS_REACT_ACT_ENVIRONMENT
    ) {
        return;
    }

    queueMicrotask(() => {
        root.unmount();
    });
}
