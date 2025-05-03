import React, { useRef, useState, useEffect } from 'react';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';
import { ClipboardCopy } from 'lucide-react';
import { useLayerzTheme, spacing, borderRadius, typography } from './theme';

export const SelectFeeSlider: React.FC<
  {
    onChange: (value: number) => void;
  } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>
> = ({ onChange, ...props }) => {
  const theme = useLayerzTheme();

  return (
    <input
      type="range"
      {...props}
      min={props.min ?? 1}
      max={props.max ?? 5}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        onChange(+event.target.value);
      }}
      style={{
        // Add styles using theme tokens
        accentColor: theme.primary,
      }}
    />
  );
};

// Switch Component
export const Switch: React.FC<{
  items: string[];
  activeItem: string;
  onItemClick: (item: string) => void;
}> = ({ items, activeItem, onItemClick }) => {
  const theme = useLayerzTheme();

  return (
    <div
      style={{
        display: 'flex',
        backgroundColor: theme.surfaceBackground,
        borderRadius: borderRadius.lg,
        padding: spacing.xs,
        width: '100%',
      }}
    >
      {items.map((item) => (
        <button
          key={item}
          onClick={() => onItemClick(item)}
          style={{
            flex: 1,
            padding: `${spacing.sm}px ${spacing.md}px`,
            border: 'none',
            borderRadius: borderRadius.md,
            backgroundColor: item === activeItem ? theme.primary : 'transparent',
            color: item === activeItem ? theme.white : theme.textSecondary,
            fontWeight: item === activeItem ? typography.fontWeights.bold : typography.fontWeights.regular,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            outline: 'none',
            fontSize: typography.fontSizes.md,
          }}
        >
          {capitalizeFirstLetter(item)}
        </button>
      ))}
    </div>
  );
};

// Button Component
export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { disabled?: boolean }> = ({ children, disabled, style, ...props }) => {
  const theme = useLayerzTheme();

  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        backgroundColor: theme.primary,
        color: theme.white,
        border: `1px solid ${theme.border}`,
        padding: `${spacing.sm}px ${spacing.md}px`,
        borderRadius: borderRadius.md,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: typography.fontSizes.md,
        transition: 'background-color 0.3s',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        margin: `0 ${spacing.xs}px ${spacing.xs}px 0`,
        ...style, // Merge any custom styles passed as props
      }}
    >
      {React.Children.map(children, (child) => (
        <span style={{ display: 'flex', alignItems: 'center', marginRight: spacing.xs }}>{child}</span>
      ))}
    </button>
  );
};

// WideButton Component
export const WideButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { disabled?: boolean }> = ({ children, disabled, ...props }) => {
  const theme = useLayerzTheme();

  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        backgroundColor: theme.primary,
        color: theme.white,
        border: `1px solid ${theme.border}`,
        padding: `${spacing.sm}px ${spacing.md}px`,
        borderRadius: borderRadius.md,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: typography.fontSizes.md,
        transition: 'background-color 0.3s',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        margin: `0 ${spacing.xs}px ${spacing.xs}px 0`,
      }}
    >
      {React.Children.map(children, (child) => (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: `0 ${spacing.xs}px` }}>{child}</span>
      ))}
    </button>
  );
};

// HodlButton Component
export const HodlButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { disabled?: boolean; holdTime?: number; onHold?: () => void }> = ({
  children,
  disabled,
  holdTime = 2000, // default hold time is 2000 milliseconds (2 seconds)
  onHold,
  ...props
}) => {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const theme = useLayerzTheme();

  const startProgress = () => {
    if (disabled) return;
    setHolding(true);
    setProgress(0);
    timeoutRef.current = setInterval(() => {
      setProgress((prevProgress) => {
        if (prevProgress < 100) {
          return prevProgress + (100 * 10) / holdTime; // increment based on holdTime
        }
        clearInterval(timeoutRef.current!);
        return 100;
      });
    }, 10);
  };

  const stopProgress = () => {
    if (progress >= 100) {
      onHold && onHold();
    }
    clearInterval(timeoutRef.current!);
    setProgress(0);
    setHolding(false);
  };

  return (
    <button
      {...props}
      disabled={disabled}
      onMouseDown={startProgress}
      onMouseUp={stopProgress}
      onMouseLeave={stopProgress}
      onTouchStart={startProgress}
      onTouchEnd={stopProgress}
      style={{
        backgroundColor: theme.primary,
        color: theme.white,
        border: `1px solid ${theme.border}`,
        padding: `${spacing.sm}px ${spacing.md}px`,
        borderRadius: borderRadius.md,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: typography.fontSizes.md,
        transition: 'background-color 0.3s',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        margin: `0 ${spacing.xs}px ${spacing.xs}px 0`,
        position: 'relative',
      }}
    >
      {holding && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: `${progress}%`,
            height: '5px',
            backgroundColor: theme.white,
            transition: 'width 0.1s linear',
          }}
        />
      )}
      {React.Children.map(children, (child) => (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: `0 ${spacing.xs}px`,
            zIndex: 1,
          }}
        >
          {child}
        </span>
      ))}
    </button>
  );
};

// Input Component
export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
  const theme = useLayerzTheme();

  return (
    <input
      {...props}
      style={{
        width: '95%',
        padding: spacing.sm,
        marginBottom: spacing.sm,
        border: `1px solid ${theme.border}`,
        borderRadius: borderRadius.sm,
        fontSize: typography.fontSizes.md,
        color: theme.text,
        backgroundColor: theme.white,
      }}
    />
  );
};

// TextArea Component
export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => {
  const theme = useLayerzTheme();

  return (
    <textarea
      {...props}
      style={{
        width: '95%',
        padding: spacing.sm,
        border: `1px solid ${theme.border}`,
        borderRadius: borderRadius.sm,
        fontSize: typography.fontSizes.md,
        minHeight: '100px',
        color: theme.text,
        backgroundColor: theme.white,
      }}
    />
  );
};

// Bubble Component
export const Bubble: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useLayerzTheme();

  return (
    <div
      style={{
        backgroundColor: theme.surfaceBackground,
        borderRadius: borderRadius.xl,
        padding: `${spacing.sm}px ${spacing.md}px`,
        marginBottom: spacing.xs,
        marginRight: spacing.xs,
        display: 'inline-block',
      }}
    >
      {children}
    </div>
  );
};

// Radio Button Component
export const RadioButton: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => {
  const theme = useLayerzTheme();

  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        color: theme.text,
      }}
    >
      <input
        type="radio"
        {...props}
        style={{
          appearance: 'none',
          width: '20px',
          height: '20px',
          border: `2px solid ${theme.primary}`,
          borderRadius: '50%',
          marginRight: spacing.sm,
          position: 'relative',
        }}
      />
      <span>{label}</span>
      <style>{`
        input[type="radio"]:checked::before {
          content: '';
          display: block;
          width: 12px;
          height: 12px;
          background-color: ${theme.primary};
          border-radius: 50%;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
      `}</style>
    </label>
  );
};

// Checkbox Component
export const Checkbox: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => {
  const theme = useLayerzTheme();

  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        color: theme.text,
      }}
    >
      <input
        type="checkbox"
        {...props}
        style={{
          appearance: 'none',
          width: '20px',
          height: '20px',
          border: `2px solid ${theme.primary}`,
          borderRadius: borderRadius.xs,
          marginRight: spacing.sm,
          position: 'relative',
        }}
      />
      <span>{label}</span>
      <style>{`
        input[type="checkbox"]:checked::before {
          content: '✓';
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          height: 100%;
          color: ${theme.primary};
          font-size: 16px;
          font-weight: bold;
        }
      `}</style>
    </label>
  );
};

// Select Component
export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => {
  const theme = useLayerzTheme();

  return (
    <select
      {...props}
      style={{
        width: '100%',
        padding: spacing.sm,
        border: `1px solid ${theme.border}`,
        borderRadius: borderRadius.sm,
        fontSize: typography.fontSizes.md,
        backgroundColor: theme.white,
        color: theme.text,
      }}
    />
  );
};

// Card Component
export const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useLayerzTheme();

  return (
    <div
      style={{
        width: '95%',
        backgroundColor: theme.cardBackground,
        border: `1px solid ${theme.border}`,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        boxShadow: `0 ${spacing.xs}px ${spacing.md}px ${theme.shadow}`,
      }}
    >
      {children}
    </div>
  );
};

// Toggle Switch Component
export const ToggleSwitch: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
  const theme = useLayerzTheme();

  return (
    <label
      style={{
        display: 'inline-block',
        width: '60px',
        height: '34px',
        position: 'relative',
      }}
    >
      <input
        type="checkbox"
        {...props}
        style={{
          opacity: 0,
          width: 0,
          height: 0,
        }}
      />
      <span
        style={{
          position: 'absolute',
          cursor: 'pointer',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: theme.textTertiary,
          transition: '.4s',
          borderRadius: '34px',
        }}
      />
      <style>{`
        input:checked + span {
          background-color: ${theme.primary};
        }
        input:checked + span:before {
          transform: translateX(26px);
        }
        span:before {
          position: absolute;
          content: "";
          height: 26px;
          width: 26px;
          left: 4px;
          bottom: 4px;
          background-color: white;
          transition: .4s;
          border-radius: 50%;
        }
      `}</style>
    </label>
  );
};

// Address Bubble Component
export const AddressBubble: React.FC<{ address: string; showCopyButton: boolean }> = ({ address, showCopyButton }) => {
  const [copied, setCopied] = useState(false);
  const theme = useLayerzTheme();

  const formatAddress = (address: string) => {
    const firstPart = address.slice(0, 6);
    const lastPart = address.slice(-6);
    const middlePart = address.slice(6, -6);

    // Split the middle part in half to balance both rows
    const splitIndex = Math.ceil(middlePart.length / 2);
    const middlePart1 = address.length < 43 ? middlePart.slice(0, splitIndex) : middlePart.slice(0, 16) + '...';
    const middlePart2 = address.length < 43 ? middlePart.slice(splitIndex) : '...' + middlePart.slice(middlePart.length - 16);

    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <span style={{ fontWeight: typography.fontWeights.bold, marginRight: '1ch' }}>{firstPart}</span>
          <span>{middlePart1}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <span>{middlePart2}</span>
          <span style={{ fontWeight: typography.fontWeights.bold, marginLeft: '1ch' }}>{lastPart}</span>
        </div>
      </>
    );
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 4000); // Hide tooltip after 4 seconds
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: `${spacing.md}px 0`,
        position: 'relative',
      }}
    >
      <Bubble>
        <div
          style={{
            wordBreak: 'break-word',
            textAlign: 'left',
            padding: spacing.sm,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {formatAddress(address)}
        </div>
      </Bubble>
      {showCopyButton ? (
        <Button onClick={handleCopyToClipboard} data-testid="copy-to-clipboard" style={{ marginLeft: spacing.sm }}>
          <ClipboardCopy /> Copy
        </Button>
      ) : null}

      {/* Tooltip for "Copied!" message */}
      {copied && (
        <div
          style={{
            position: 'absolute',
            top: '-20px',
            right: '50%',
            backgroundColor: theme.text,
            color: theme.white,
            padding: `${spacing.sm}px ${spacing.md}px`,
            borderRadius: borderRadius.lg,
            fontSize: typography.fontSizes.md,
            transformOrigin: 'center',
            transform: 'translateX(50%)',
            boxShadow: `0px ${spacing.xs}px ${spacing.sm}px ${theme.shadow}`,
            opacity: 1,
            animation: 'fadeInOut 4s ease forwards',
            transition: 'all 0.5s ease',
          }}
        >
          Copied!
        </div>
      )}
    </div>
  );
};

// Modal Component
export const Modal: React.FC<{
  children: React.ReactNode;
  width?: string;
  onClose?: () => void;
  closable?: boolean;
}> = ({ children, width = '400px', onClose, closable = true }) => {
  const [isVisible, setIsVisible] = useState(false);
  const theme = useLayerzTheme();

  useEffect(() => {
    requestAnimationFrame(() => {
      setIsVisible(true);
    });

    return () => {
      setIsVisible(false);
    };
  }, []);

  const handleClose = () => {
    if (!closable) return;

    setIsVisible(false);

    setTimeout(() => {
      onClose?.();
    }, 300);
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out',
          zIndex: 999,
          cursor: closable ? 'pointer' : 'default',
        }}
        onClick={handleClose}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, ${isVisible ? '-50%' : '-45%'})`,
          border: `1px solid ${theme.border}`,
          backgroundColor: theme.cardBackground,
          opacity: isVisible ? 1 : 0,
          transition: 'all 0.3s ease-in-out',
          zIndex: 1000,
          width: width,
          padding: spacing.md,
          borderRadius: borderRadius.lg,
          boxShadow: `0 ${spacing.xs}px ${spacing.md}px ${theme.shadow}`,
        }}
      >
        {children}
      </div>
    </>
  );
};

// Text Component
export const Text: React.FC<{
  children: React.ReactNode;
  variant?: 'body' | 'caption' | 'heading' | 'title' | 'subtitle';
  style?: React.CSSProperties;
}> = ({ children, variant = 'body', style }) => {
  const theme = useLayerzTheme();

  let textStyle: React.CSSProperties = {
    color: theme.text,
    margin: 0,
  };

  switch (variant) {
    case 'title':
      textStyle = {
        ...textStyle,
        fontSize: typography.fontSizes.xxl,
        fontWeight: typography.fontWeights.bold,
        marginBottom: spacing.sm,
      };
      break;
    case 'subtitle':
      textStyle = {
        ...textStyle,
        fontSize: typography.fontSizes.lg,
        fontWeight: typography.fontWeights.medium,
        marginBottom: spacing.sm,
      };
      break;
    case 'heading':
      textStyle = {
        ...textStyle,
        fontSize: typography.fontSizes.xl,
        fontWeight: typography.fontWeights.semiBold,
        marginBottom: spacing.sm,
      };
      break;
    case 'caption':
      textStyle = {
        ...textStyle,
        fontSize: typography.fontSizes.xs,
        color: theme.textSecondary,
      };
      break;
    case 'body':
    default:
      textStyle = {
        ...textStyle,
        fontSize: typography.fontSizes.md,
      };
  }

  return <div style={{ ...textStyle, ...style }}>{children}</div>;
};

// Container Component
export const Container: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => {
  const theme = useLayerzTheme();

  return (
    <div
      style={{
        padding: spacing.md,
        width: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Main Component to showcase all elements
export default function DesignSystem() {
  const [radioValue, setRadioValue] = useState('');
  const [checkboxValue, setCheckboxValue] = useState(false);
  const [toggleValue, setToggleValue] = useState(false);
  const theme = useLayerzTheme();

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: spacing.md,
        backgroundColor: theme.background,
        color: theme.text,
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <h1 style={{ textAlign: 'center', marginBottom: spacing.xxl, fontSize: typography.fontSizes.xxxl }}>Design System</h1>

      <Card>
        <h2 style={{ fontSize: typography.fontSizes.xl, marginBottom: spacing.md }}>Buttons</h2>
        <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.md }}>
          <Button>Primary Button</Button>
          <Button style={{ backgroundColor: 'transparent', border: `2px solid ${theme.primary}`, color: theme.primary }}>Secondary Button</Button>
        </div>

        <h2 style={{ fontSize: typography.fontSizes.xl, marginBottom: spacing.sm }}>Inputs</h2>
        <div style={{ marginBottom: spacing.md }}>
          <Input placeholder="Enter text here" />
        </div>

        <h2 style={{ fontSize: typography.fontSizes.xl, marginBottom: spacing.sm }}>TextArea</h2>
        <div style={{ marginBottom: spacing.md }}>
          <TextArea placeholder="Enter longer text here" />
        </div>

        <h2 style={{ fontSize: typography.fontSizes.xl, marginBottom: spacing.sm }}>Bubbles</h2>
        <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.md }}>
          <Bubble>Bubble 1</Bubble>
          <Bubble>Bubble 2</Bubble>
        </div>

        <h2 style={{ fontSize: typography.fontSizes.xl, marginBottom: spacing.sm }}>Radio Buttons</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, marginBottom: spacing.md }}>
          <RadioButton label="Option 1" name="radioGroup" value="1" checked={radioValue === '1'} onChange={(e) => setRadioValue(e.target.value)} />
          <RadioButton label="Option 2" name="radioGroup" value="2" checked={radioValue === '2'} onChange={(e) => setRadioValue(e.target.value)} />
        </div>

        <h2 style={{ fontSize: typography.fontSizes.xl, marginBottom: spacing.sm }}>Checkboxes</h2>
        <div style={{ marginBottom: spacing.md }}>
          <Checkbox label="Check me" checked={checkboxValue} onChange={(e) => setCheckboxValue(e.target.checked)} />
        </div>

        <h2 style={{ fontSize: typography.fontSizes.xl, marginBottom: spacing.sm }}>Select</h2>
        <div style={{ marginBottom: spacing.md }}>
          <Select>
            <option value="">Select an option</option>
            <option value="1">Option 1</option>
            <option value="2">Option 2</option>
          </Select>
        </div>

        <h2 style={{ fontSize: typography.fontSizes.xl, marginBottom: spacing.sm }}>Toggle Switch</h2>
        <div style={{ marginBottom: spacing.md }}>
          <ToggleSwitch checked={toggleValue} onChange={(e) => setToggleValue(e.target.checked)} />
        </div>

        <h2 style={{ fontSize: typography.fontSizes.xl, marginBottom: spacing.sm }}>Address Bubble</h2>
        <div style={{ marginBottom: spacing.md }}>
          <AddressBubble address="0x1234567890abcdef1234567890abcdef12345678" showCopyButton={true} />
        </div>
      </Card>
    </div>
  );
}
