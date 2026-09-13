import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import React from 'react';

import styles from './index.module.scss';

interface Feature {
    title: string;
    description: string;
}

const FEATURES: Feature[] = [
    {
        title: 'Component Tree Explorer',
        description:
            'Inspect React roots, component hierarchy, props, hooks, and render state from a UI shaped for everyday debugging.'
    },
    {
        title: 'Framework Integrations',
        description:
            'Support browser extension, Vite overlay, and standalone development flows from one shared protocol and client.'
    },
    {
        title: 'Plugin Surface',
        description:
            'Expose custom inspectors and app-specific panels so routers, stores, and product tooling can meet the React tree.'
    },
    {
        title: 'Beautiful Development UI',
        description:
            'Rebuild the useful parts of the Vue Devtools experience with a React-first interface that is fast, calm, and readable.'
    }
];

const ROADMAP_ITEMS = [
    'Shared protocol and plugin API',
    'Fiber walker and component inspection',
    'Client UI, Vite overlay, and browser extension',
    'Playgrounds, docs, smoke tests, and release packaging'
];

function HomepageHero() {
    return (
        <header className={styles.hero}>
            <div className="container">
                <div className={styles.heroInner}>
                    <p className={styles.eyebrow}>React DevTools rebuild</p>
                    <h1 className={styles.title}>React DevTools</h1>
                    <p className={styles.tagline}>
                        A modern developer tools ecosystem for React apps.
                    </p>
                    <p className={styles.subtagline}>
                        Component inspection, framework integrations, plugin
                        APIs, and a polished UI are being built here in public.
                    </p>
                    <div className={styles.buttons}>
                        <Link
                            className="button button--primary button--lg"
                            to="/docs/intro"
                        >
                            Read the Docs
                        </Link>
                        <Link
                            className="button button--secondary button--lg"
                            to="https://github.com/jared-leddy/react-devtools"
                        >
                            View on GitHub
                        </Link>
                    </div>
                </div>
            </div>
        </header>
    );
}

function FeatureCard({ title, description }: Feature) {
    return (
        <article className={styles.featureCard}>
            <h3 className={styles.featureTitle}>{title}</h3>
            <p className={styles.featureDescription}>{description}</p>
        </article>
    );
}

function FeatureGrid() {
    return (
        <section className={styles.features}>
            <div className="container">
                <div className={styles.sectionHeader}>
                    <h2>Project Direction</h2>
                    <p>
                        These placeholders mark the homepage story for Phase 7,
                        once the real packages and integration paths have
                        landed.
                    </p>
                </div>
                <div className={styles.featureGrid}>
                    {FEATURES.map((feature) => (
                        <FeatureCard key={feature.title} {...feature} />
                    ))}
                </div>
            </div>
        </section>
    );
}

function RoadmapPreview() {
    return (
        <section className={styles.quickLook}>
            <div className="container">
                <div className={styles.quickLookInner}>
                    <div className={styles.quickLookCopy}>
                        <h2>What lands before the docs are final</h2>
                        <p>
                            The API examples will be written after the shared
                            runtime, client UI, Vite integration, extension, and
                            plugin contracts exist.
                        </p>
                        <Link
                            className="button button--primary"
                            to="/docs/intro"
                        >
                            Start with the Project Notes
                        </Link>
                    </div>
                    <ol className={styles.roadmapList}>
                        {ROADMAP_ITEMS.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ol>
                </div>
            </div>
        </section>
    );
}

export default function Home(): React.JSX.Element {
    return (
        <Layout
            title="React DevTools"
            description="A modern developer tools ecosystem for React apps."
        >
            <HomepageHero />
            <main>
                <FeatureGrid />
                <RoadmapPreview />
            </main>
        </Layout>
    );
}
