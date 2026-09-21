import type { ReactNode } from 'react';
import { useId, useState } from 'react';
import { Button } from './Button';

export interface DropdownItem {
    disabled?: boolean;
    id: string;
    label: ReactNode;
    onSelect: () => void;
}

export interface DropdownProps {
    buttonLabel: ReactNode;
    items: DropdownItem[];
}

export function Dropdown({ buttonLabel, items }: DropdownProps) {
    const id = useId();
    const [open, setOpen] = useState(false);

    return (
        <div className="dt-dropdown">
            <Button
                aria-controls={id}
                aria-expanded={open}
                aria-haspopup="menu"
                onClick={() => setOpen((value) => !value)}
            >
                {buttonLabel}
            </Button>
            {open ? (
                <div className="dt-dropdown__menu" id={id} role="menu">
                    {items.map((item) => (
                        <button
                            className="dt-dropdown__item"
                            disabled={item.disabled}
                            key={item.id}
                            onClick={() => {
                                item.onSelect();
                                setOpen(false);
                            }}
                            role="menuitem"
                            type="button"
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
