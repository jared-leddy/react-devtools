import type { ButtonHTMLAttributes } from 'react';

export interface SwitchProps extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'onChange' | 'role'
> {
    checked: boolean;
    label: string;
    onCheckedChange: (checked: boolean) => void;
}

export function Switch({
    checked,
    className = '',
    label,
    onCheckedChange,
    ...props
}: SwitchProps) {
    return (
        <button
            aria-checked={checked}
            className={`dt-switch ${className}`.trim()}
            onClick={() => onCheckedChange(!checked)}
            role="switch"
            type="button"
            {...props}
        >
            <span className="dt-switch__track">
                <span className="dt-switch__thumb" />
            </span>
            <span className="dt-switch__label">{label}</span>
        </button>
    );
}
