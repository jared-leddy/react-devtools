import type { ReactNode } from 'react';

export type StateViewerValue =
    boolean | null | number | string | StateViewerCustomValue;

export interface StateViewerCustomValue {
    _custom: {
        display: string;
        preview?: string;
        readOnly?: boolean;
        type: string;
        value?: StateViewerValue | StateViewerValue[] | StateViewerValueMap;
    };
}

export type StateViewerValueMap = Record<string, StateViewerValue>;

export interface StateViewerField {
    editable?: boolean;
    name: string;
    value: StateViewerValue;
}

export interface StateViewerSection {
    fields: StateViewerField[];
    name: 'context' | 'hooks' | 'props' | 'state' | string;
}

export interface StateViewerProps {
    emptyLabel?: string;
    sections: StateViewerSection[];
}

export function StateViewer({
    emptyLabel = 'No props, hooks, or state recorded for this component.',
    sections
}: StateViewerProps) {
    const visibleSections = sections.filter((section) => section.fields.length);

    return (
        <section
            aria-label="State, props, and hooks"
            className="dt-state-viewer"
        >
            <div className="dt-state-viewer__toolbar">
                <span className="dt-state-viewer__status">Read-only</span>
            </div>

            {visibleSections.length ? (
                visibleSections.map((section) => (
                    <section
                        aria-label={getSectionLabel(section.name)}
                        className="dt-state-viewer__section"
                        key={section.name}
                    >
                        <h3>{getSectionLabel(section.name)}</h3>
                        <dl className="dt-state-viewer__fields">
                            {section.fields.map((field) => (
                                <div
                                    className="dt-state-viewer__field"
                                    key={field.name}
                                >
                                    <dt>{field.name}</dt>
                                    <dd>
                                        <StateValue value={field.value} />
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </section>
                ))
            ) : (
                <p className="dt-state-viewer__empty">{emptyLabel}</p>
            )}
        </section>
    );
}

function StateValue({ value }: { value: StateViewerValue }) {
    if (isCustomValue(value)) {
        return <CustomStateValue value={value} />;
    }

    return (
        <span
            className={`dt-state-viewer__value dt-state-viewer__value--${getPrimitiveType(
                value
            )}`}
        >
            {formatPrimitiveValue(value)}
        </span>
    );
}

function CustomStateValue({ value }: { value: StateViewerCustomValue }) {
    const custom = value._custom;
    const nestedValue = custom.value;

    return (
        <span className="dt-state-viewer__custom">
            <span className="dt-state-viewer__custom-summary">
                <span className="dt-state-viewer__value dt-state-viewer__value--custom">
                    {custom.display}
                </span>
                <span className="dt-state-viewer__type">{custom.type}</span>
                {custom.readOnly === true ? (
                    <span className="dt-state-viewer__readonly">read-only</span>
                ) : null}
                {custom.preview ? (
                    <span className="dt-state-viewer__preview">
                        {custom.preview}
                    </span>
                ) : null}
            </span>
            {nestedValue === undefined ? null : (
                <NestedStateValue type={custom.type} value={nestedValue} />
            )}
        </span>
    );
}

function NestedStateValue({
    type,
    value
}: {
    type: string;
    value: Exclude<StateViewerCustomValue['_custom']['value'], undefined>;
}) {
    if (Array.isArray(value)) {
        return (
            <ol className="dt-state-viewer__children">
                {value.map((item, index) => (
                    <li
                        className="dt-state-viewer__child"
                        key={`${type}-${index}`}
                    >
                        <span className="dt-state-viewer__key">
                            {getArrayEntryLabel(type, index)}
                        </span>
                        <StateValue value={item} />
                    </li>
                ))}
            </ol>
        );
    }

    if (isCustomValue(value)) {
        return (
            <div className="dt-state-viewer__children">
                <StateValue value={value} />
            </div>
        );
    }

    if (isValueMap(value)) {
        return (
            <dl className="dt-state-viewer__children">
                {Object.entries(value).map(([key, item]) => (
                    <div className="dt-state-viewer__child" key={key}>
                        <dt className="dt-state-viewer__key">{key}</dt>
                        <dd>
                            <StateValue value={item} />
                        </dd>
                    </div>
                ))}
            </dl>
        );
    }

    return <StateValue value={value} />;
}

function getSectionLabel(name: string): string {
    if (name === 'props') {
        return 'Props';
    }

    if (name === 'hooks') {
        return 'Hooks';
    }

    if (name === 'state') {
        return 'Class State';
    }

    if (name === 'context') {
        return 'Context';
    }

    return name;
}

function getArrayEntryLabel(type: string, index: number): ReactNode {
    if (type === 'set') {
        return `Value ${index}`;
    }

    return index;
}

function getPrimitiveType(value: boolean | null | number | string): string {
    if (value === null) {
        return 'null';
    }

    return typeof value;
}

function formatPrimitiveValue(value: boolean | null | number | string): string {
    if (typeof value === 'string') {
        return JSON.stringify(value);
    }

    return String(value);
}

function isCustomValue(value: unknown): value is StateViewerCustomValue {
    return (
        typeof value === 'object' &&
        value !== null &&
        '_custom' in value &&
        typeof value._custom === 'object' &&
        value._custom !== null
    );
}

function isValueMap(value: unknown): value is StateViewerValueMap {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
