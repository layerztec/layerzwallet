import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { darkenHex, hexToRgba } from '@shared/constants/Colors';

import './DropdownSelect.css';

export type DropdownOption<T extends string | number> = {
  value: T;
  label: React.ReactNode;
  testId?: string;
};

type DropdownSelectProps<T extends string | number> = {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  triggerClassName?: string;
  variant?: 'default' | 'form';
  disabled?: boolean;
  testId?: string;
  triggerTestId?: string;
  menuAccentColor?: string;
  renderTrigger?: (selected: DropdownOption<T>, isOpen: boolean) => React.ReactNode;
};

function valuesEqual<T extends string | number>(a: T, b: T): boolean {
  return String(a) === String(b);
}

export function DropdownSelect<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  triggerClassName,
  variant = 'default',
  disabled,
  testId,
  triggerTestId,
  menuAccentColor,
  renderTrigger,
}: DropdownSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const menuId = useId();

  const selected = options.find((o) => valuesEqual(o.value, value)) ?? options[0];

  const accentMenuStyle = useMemo((): React.CSSProperties | undefined => {
    if (!menuAccentColor) {
      return undefined;
    }
    return {
      ['--dropdown-accent' as string]: menuAccentColor,
      background: `linear-gradient(180deg, ${darkenHex(menuAccentColor, 0.32)} 0%, #050505 88%)`,
      borderColor: hexToRgba(menuAccentColor, 0.45),
      boxShadow: `0 12px 32px rgba(0, 0, 0, 0.55), 0 0 0 1px ${hexToRgba(menuAccentColor, 0.12)}`,
    };
  }, [menuAccentColor]);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    setMenuStyle({
      top: rect.bottom + 4,
      left: rect.left,
      minWidth: rect.width,
    });
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const toggle = useCallback(() => {
    if (disabled) {
      return;
    }
    setIsOpen((open) => !open);
  }, [disabled]);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }
    updateMenuPosition();
  }, [isOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      close();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    const onScrollOrResize = () => updateMenuPosition();

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [close, isOpen, updateMenuPosition]);

  const handleSelect = (next: T) => {
    if (!valuesEqual(next, value)) {
      onChange(next);
    }
    close();
  };

  const defaultTrigger = (
    <>
      <span className="dropdown-select-trigger-label">{selected?.label}</span>
      <span className="dropdown-select-chevron" aria-hidden>
        ▾
      </span>
    </>
  );

  return (
    <div ref={rootRef} className={['dropdown-select', variant === 'form' ? 'dropdown-select--form' : '', className].filter(Boolean).join(' ')} data-testid={testId}>
      <button
        ref={triggerRef}
        type="button"
        className={['dropdown-select-trigger', triggerClassName].filter(Boolean).join(' ')}
        onClick={toggle}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        data-testid={triggerTestId}
      >
        {renderTrigger && selected ? renderTrigger(selected, isOpen) : defaultTrigger}
      </button>

      {isOpen && selected
        ? createPortal(
            <ul
              ref={menuRef}
              id={menuId}
              className={['dropdown-select-menu', menuAccentColor ? 'dropdown-select-menu--accent' : ''].filter(Boolean).join(' ')}
              style={{ ...menuStyle, ...accentMenuStyle }}
              role="listbox"
              aria-label={ariaLabel}
            >
              {options.map((option) => (
                <li key={String(option.value)} role="presentation">
                  <button
                    type="button"
                    className={['dropdown-select-option', valuesEqual(option.value, value) ? 'dropdown-select-option--selected' : ''].filter(Boolean).join(' ')}
                    role="option"
                    aria-selected={valuesEqual(option.value, value)}
                    data-testid={option.testId}
                    onClick={() => handleSelect(option.value)}
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>,
            document.body
          )
        : null}
    </div>
  );
}
