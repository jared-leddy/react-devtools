import { useState } from 'react';
import {
    Button,
    Card,
    CodeBlock,
    Dialog,
    Dropdown,
    Notification,
    Select,
    Switch,
    Tooltip
} from '../components';
import { ThemeProvider, ThemeToggle, useTheme } from '../theme';

function ShowcaseContent() {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selected, setSelected] = useState('components');
    const [checked, setChecked] = useState(true);
    const [noticeVisible, setNoticeVisible] = useState(true);
    const [lastAction, setLastAction] = useState('Ready');
    const { theme } = useTheme();

    return (
        <main className="dt-showcase">
            <header className="dt-showcase__header">
                <div>
                    <p className="dt-showcase__eyebrow">@devtools/ui</p>
                    <h1>React DevTools UI Kit</h1>
                </div>
                <ThemeToggle />
            </header>

            {noticeVisible ? (
                <Notification
                    title="Design system online"
                    tone="success"
                    onClose={() => setNoticeVisible(false)}
                >
                    Components are themed, accessible, and ready for panel
                    composition.
                </Notification>
            ) : null}

            <div className="dt-showcase__grid">
                <Card
                    actions={
                        <Tooltip label="Opens a focused modal surface">
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDialogOpen(true)}
                            >
                                Inspect
                            </Button>
                        </Tooltip>
                    }
                    title="Controls"
                >
                    <div className="dt-showcase__stack">
                        <Button
                            variant="primary"
                            onClick={() => setLastAction('Primary action')}
                        >
                            Primary
                        </Button>
                        <Dropdown
                            buttonLabel="Actions"
                            items={[
                                {
                                    id: 'copy',
                                    label: 'Copy selector',
                                    onSelect: () =>
                                        setLastAction('Copied selector')
                                },
                                {
                                    id: 'trace',
                                    label: 'Trace render',
                                    onSelect: () =>
                                        setLastAction('Tracing render')
                                }
                            ]}
                        />
                        <Select
                            label="Panel"
                            options={[
                                { label: 'Components', value: 'components' },
                                { label: 'Profiler', value: 'profiler' }
                            ]}
                            value={selected}
                            onChange={(event) =>
                                setSelected(event.currentTarget.value)
                            }
                        />
                        <Switch
                            checked={checked}
                            label="Highlight updates"
                            onCheckedChange={setChecked}
                        />
                        <p className="dt-showcase__status">{lastAction}</p>
                    </div>
                </Card>

                <Card title="Code">
                    <CodeBlock
                        code={`function ${selected}Panel() {\n  return <Panel theme="${theme}" />;\n}`}
                        language="tsx"
                        theme={theme}
                    />
                </Card>
            </div>

            <Dialog
                description="The component surface is intentionally small and composable."
                open={dialogOpen}
                title="Inspector shell"
                onOpenChange={setDialogOpen}
            >
                <p>
                    Use these primitives to build the React DevTools client
                    without a third-party kit.
                </p>
            </Dialog>
        </main>
    );
}

export function UIShowcase() {
    return (
        <ThemeProvider>
            <ShowcaseContent />
        </ThemeProvider>
    );
}
