import type { SelectHTMLAttributes } from 'react';
import { useId } from 'react';

export interface SelectOption {
    disabled?: boolean;
    label: string;
    value: string;
}

export interface SelectProps extends Omit<
    SelectHTMLAttributes<HTMLSelectElement>,
    'children'
> {
    label: string;
    options: SelectOption[];
}

export function Select({
    className = '',
    label,
    options,
    id,
    ...props
}: SelectProps) {
    const fallbackId = useId();
    const selectId = id ?? fallbackId;

    return (
        <label className={`dt-select ${className}`.trim()} htmlFor={selectId}>
            <span className="dt-select__label">{label}</span>
            <select className="dt-select__control" id={selectId} {...props}>
                {options.map((option) => (
                    <option
                        disabled={option.disabled}
                        key={option.value}
                        value={option.value}
                    >
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );
}
