import { useState, type ReactNode } from 'react';

export type StateViewerValue =
    boolean | null | number | string | StateViewerCustomValue;

export type StateViewerEditOperation =
    | {
          newKey?: string;
          type: 'set';
          value: StateViewerValue;
      }
    | {
          type: 'remove';
      };

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
    path?: Array<number | string>;
    value: StateViewerValue;
}

export interface StateViewerSection {
    fields: StateViewerField[];
    name: 'context' | 'hooks' | 'props' | 'state' | string;
}

export interface StateViewerProps {
    emptyLabel?: string;
    onEditField?: (
        field: StateViewerField,
        operation: StateViewerEditOperation
    ) => void;
    sections: StateViewerSection[];
}

export function StateViewer({
    emptyLabel = 'No props, hooks, or state recorded for this component.',
    onEditField,
    sections
}: StateViewerProps) {
    const visibleSections = sections.filter((section) => section.fields.length);
    const hasEditableFields = sections.some((section) =>
        section.fields.some((field) => field.editable)
    );

    return (
        <section
            aria-label="State, props, and hooks"
            className="dt-state-viewer"
        >
            <div className="dt-state-viewer__toolbar">
                <span className="dt-state-viewer__status">
                    {hasEditableFields
                        ? 'Editable fields available'
                        : 'Read-only'}
                </span>
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
                                        <EditableStateValue
                                            field={field}
                                            onEditField={onEditField}
                                        />
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

function EditableStateValue({
    field,
    onEditField
}: {
    field: StateViewerField;
    onEditField?: (
        field: StateViewerField,
        operation: StateViewerEditOperation
    ) => void;
}) {
    const [editValue, setEditValue] = useState(() =>
        getEditableInputValue(field.value)
    );
    const [editKey, setEditKey] = useState(field.name);
    const canEdit = Boolean(field.editable && onEditField);

    if (!canEdit) {
        return <StateValue value={field.value} />;
    }

    return (
        <span className="dt-state-viewer__editor">
            <StateValue value={field.value} />
            <input
                aria-label={`Edit ${field.name} key`}
                onChange={(event) => {
                    setEditKey(event.target.value);
                }}
                value={editKey}
            />
            <textarea
                aria-label={`Edit ${field.name} value`}
                onChange={(event) => {
                    setEditValue(event.target.value);
                }}
                value={editValue}
            />
            <button
                onClick={() => {
                    onEditField?.(field, {
                        newKey: editKey === field.name ? undefined : editKey,
                        type: 'set',
                        value: coerceEditableValue(editValue, field.value)
                    });
                }}
                type="button"
            >
                Save
            </button>
            <button
                onClick={() => {
                    onEditField?.(field, { type: 'remove' });
                }}
                type="button"
            >
                Remove
            </button>
        </span>
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

function getEditableInputValue(value: StateViewerValue): string {
    if (typeof value === 'string') {
        return value;
    }

    if (isCustomValue(value)) {
        return value._custom.value === undefined
            ? value._custom.display
            : JSON.stringify(value._custom.value, null, 2);
    }

    return JSON.stringify(value);
}

function coerceEditableValue(
    value: string,
    previousValue: StateViewerValue
): StateViewerValue {
    if (typeof previousValue === 'string') {
        return value;
    }

    try {
        const parsed = JSON.parse(value) as unknown;

        if (isStateViewerValue(parsed)) {
            return parsed;
        }

        if (isCustomValue(previousValue)) {
            return {
                _custom: {
                    ...previousValue._custom,
                    display: formatCustomDisplay(parsed),
                    preview:
                        typeof parsed === 'object' && parsed !== null
                            ? JSON.stringify(parsed)
                            : undefined,
                    type: Array.isArray(parsed) ? 'array' : typeof parsed,
                    value: toNestedStateViewerValue(parsed)
                }
            };
        }

        return value;
    } catch {
        return value;
    }
}

function isStateViewerValue(value: unknown): value is StateViewerValue {
    if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return true;
    }

    return isCustomValue(value);
}

function toNestedStateViewerValue(
    value: unknown
): StateViewerCustomValue['_custom']['value'] {
    if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((item) => toStateViewerValue(item));
    }

    if (typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(
                ([key, item]) => [key, toStateViewerValue(item)]
            )
        );
    }

    return String(value);
}

function toStateViewerValue(value: unknown): StateViewerValue {
    if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return value;
    }

    return {
        _custom: {
            display: formatCustomDisplay(value),
            preview:
                typeof value === 'object' && value !== null
                    ? JSON.stringify(value)
                    : undefined,
            type: Array.isArray(value) ? 'array' : typeof value,
            value: toNestedStateViewerValue(value)
        }
    };
}

function formatCustomDisplay(value: unknown): string {
    if (Array.isArray(value)) {
        return `Array(${value.length})`;
    }

    if (value && typeof value === 'object') {
        return 'Object';
    }

    return String(value);
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
