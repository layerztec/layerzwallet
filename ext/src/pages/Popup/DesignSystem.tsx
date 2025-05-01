import React, { useState } from 'react';
import { useTheme } from '../../hooks/ThemeContext';

// Button Component
export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { disabled?: boolean; style?: React.CSSProperties }> = ({ children, disabled, style, ...props }) => {
  const { getColor } = useTheme();

  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        backgroundColor: getColor('primary'),
        color: 'white',
        border: 'none',
        padding: '12px 20px',
        borderRadius: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '16px',
        fontWeight: '600',
        transition: 'opacity 0.2s ease',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        ...style, // Merge any custom styles passed as props
      }}
    >
      {React.Children.map(children, (child) => (
        <span style={{ display: 'flex', alignItems: 'center', marginRight: '5px' }}>{child}</span>
      ))}
    </button>
  );
};

// WideButton Component
export const WideButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { disabled?: boolean }> = ({ children, disabled, ...props }) => {
  const { getColor } = useTheme();

  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        backgroundColor: getColor('primary'),
        color: 'white',
        border: 'none',
        padding: '12px 20px',
        borderRadius: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '16px',
        fontWeight: '600',
        transition: 'opacity 0.2s ease',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        marginBottom: '10px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      }}
    >
      {React.Children.map(children, (child) => (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 5px' }}>{child}</span>
      ))}
    </button>
  );
};

// LongPressButton Component
export const LongPressButton: React.FC<{ onComplete: () => void; disabled?: boolean; duration?: number }> = ({ children, onComplete, disabled = false, duration = 1500 }) => {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timerId, setTimerId] = useState<number | null>(null);
  const { getColor } = useTheme();

  const startHold = () => {
    if (disabled) return;

    setHolding(true);
    setProgress(0);

    const startTime = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(newProgress);

      if (newProgress >= 100) {
        clearInterval(timer);
        onComplete();
        setHolding(false);
        setProgress(0);
      }
    }, 10) as unknown as number;

    setTimerId(timer);
  };

  const stopHold = () => {
    if (timerId !== null) {
      clearInterval(timerId);
      setTimerId(null);
    }
    setHolding(false);
    setProgress(0);
  };

  return (
    <button
      onMouseDown={startHold}
      onMouseUp={stopHold}
      onMouseLeave={stopHold}
      onTouchStart={startHold}
      onTouchEnd={stopHold}
      disabled={disabled}
      style={{
        backgroundColor: getColor('primary'),
        color: 'white',
        border: 'none',
        padding: '12px 20px',
        borderRadius: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '16px',
        fontWeight: '600',
        opacity: disabled ? 0.5 : 1,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
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
            backgroundColor: 'white',
            transition: 'width 0.1s linear',
          }}
        />
      )}
      {React.Children.map(children, (child) => (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 5px', zIndex: 1 }}>{child}</span>
      ))}
    </button>
  );
};

// Input Component
export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
  const { getColor } = useTheme();

  return (
    <input
      {...props}
      style={{
        width: '100%',
        padding: '12px',
        marginBottom: '10px',
        border: `1px solid ${getColor('border')}`,
        borderRadius: '8px',
        fontSize: '16px',
        color: getColor('text'),
        backgroundColor: getColor('background'),
        outline: 'none',
        transition: 'border-color 0.2s ease',
        boxSizing: 'border-box',
        ...(props.style || {}),
      }}
    />
  );
};

// TextArea Component
export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => {
  const { getColor } = useTheme();

  return (
    <textarea
      {...props}
      style={{
        width: '100%',
        padding: '12px',
        border: `1px solid ${getColor('border')}`,
        borderRadius: '8px',
        fontSize: '16px',
        minHeight: '100px',
        color: getColor('text'),
        backgroundColor: getColor('background'),
        outline: 'none',
        transition: 'border-color 0.2s ease',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
        resize: 'vertical',
        ...(props.style || {}),
      }}
    />
  );
};

// Bubble Component
export const Bubble: React.FC<{ children: React.ReactNode; active?: boolean }> = ({ children, active = false }) => {
  const { getColor } = useTheme();

  return (
    <div
      style={{
        backgroundColor: active ? getColor('primary') : getColor('buttonBackground'),
        color: active ? 'white' : getColor('text'),
        borderRadius: '20px',
        padding: '8px 16px',
        marginBottom: '5px',
        marginRight: '5px',
        display: 'inline-block',
        transition: 'background-color 0.2s ease, transform 0.2s ease',
        cursor: 'pointer',
        transform: active ? 'scale(1.05)' : 'scale(1)',
        fontWeight: active ? 600 : 400,
        boxShadow: active ? '0 2px 4px rgba(0, 0, 0, 0.1)' : 'none',
      }}
    >
      {children}
    </div>
  );
};

// Radio Button Component
export const RadioButton: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & {
    label: string;
  }
> = ({ label, ...props }) => {
  const { getColor } = useTheme();
  const id = `radio-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', cursor: 'pointer' }}>
      <input type="radio" id={id} {...props} style={{ margin: '0 10px 0 0' }} />
      <span style={{ color: getColor('text') }}>{label}</span>
      <style jsx>{`
        input[type='radio'] {
          appearance: none;
          width: 20px;
          height: 20px;
          border: 2px solid ${getColor('primary')};
          border-radius: 50%;
          outline: none;
          position: relative;
        }
        input[type='radio']:checked::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background-color: ${getColor('primary')};
        }
      `}</style>
    </label>
  );
};

// Checkbox Component
export const Checkbox: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & {
    label: string;
  }
> = ({ label, ...props }) => {
  const { getColor } = useTheme();
  const id = `checkbox-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', cursor: 'pointer' }}>
      <input type="checkbox" id={id} {...props} style={{ margin: '0 10px 0 0' }} />
      <span style={{ color: getColor('text') }}>{label}</span>
      <style jsx>{`
        input[type='checkbox'] {
          appearance: none;
          width: 20px;
          height: 20px;
          border: 2px solid ${getColor('primary')};
          border-radius: 4px;
          outline: none;
          position: relative;
        }
        input[type='checkbox']:checked::before {
          content: '';
          position: absolute;
          top: 2px;
          left: 6px;
          width: 5px;
          height: 10px;
          border-right: 2px solid white;
          border-bottom: 2px solid white;
          transform: rotate(45deg);
        }
        input[type='checkbox']:checked {
          background-color: ${getColor('primary')};
        }
      `}</style>
    </label>
  );
};

// Label Component
export const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({ children, ...props }) => {
  const { getColor } = useTheme();

  return (
    <label
      {...props}
      style={{
        display: 'block',
        marginBottom: '8px',
        color: getColor('subtleText'),
        fontSize: '14px',
        ...(props.style || {}),
      }}
    >
      {children}
      <style jsx>{`
        label {
          font-weight: 600;
        }
      `}</style>
    </label>
  );
};

// Select Component
export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => {
  const { getColor } = useTheme();

  return (
    <select
      {...props}
      style={{
        width: '100%',
        padding: '12px',
        border: `1px solid ${getColor('border')}`,
        borderRadius: '8px',
        fontSize: '16px',
        backgroundColor: getColor('background'),
        color: getColor('text'),
        outline: 'none',
        cursor: 'pointer',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
        backgroundSize: '16px',
        paddingRight: '40px',
        ...(props.style || {}),
      }}
    />
  );
};

// Card Component
export const Card: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title }) => {
  const { getColor } = useTheme();

  return (
    <div
      style={{
        width: '100%',
        backgroundColor: getColor('card'),
        border: `1px solid ${getColor('border')}`,
        borderRadius: '12px',
        padding: '20px',
        boxShadow: `0 4px 6px ${getColor('shadowColor')}`,
        marginBottom: '20px',
      }}
    >
      {title && <h3 style={{ margin: '0 0 16px 0', color: getColor('text'), fontSize: '20px', fontWeight: 'bold' }}>{title}</h3>}
      {children}
    </div>
  );
};

// Toggle Switch Component
export const ToggleSwitch: React.FC<{ checked: boolean; onChange: () => void; label: string }> = ({ checked, onChange, label }) => {
  const { getColor } = useTheme();

  return (
    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}>
      <div
        style={{
          position: 'relative',
          width: '48px',
          height: '24px',
          backgroundColor: checked ? getColor('primary') : getColor('buttonBackground'),
          borderRadius: '24px',
          transition: 'background-color 0.2s',
          marginRight: '10px',
        }}
        onClick={onChange}
      >
        <div
          style={{
            position: 'absolute',
            top: '2px',
            left: checked ? '26px' : '2px',
            width: '20px',
            height: '20px',
            backgroundColor: 'white',
            borderRadius: '50%',
            transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
          }}
        />
      </div>
      <span style={{ color: getColor('text') }}>{label}</span>
    </label>
  );
};

// Alert Component
export const Alert: React.FC<{ children: React.ReactNode; type?: 'info' | 'success' | 'warning' | 'error'; onClose?: () => void }> = ({ children, type = 'info', onClose }) => {
  const { getColor } = useTheme();

  const getAlertColor = () => {
    switch (type) {
      case 'info':
        return getColor('info');
      case 'success':
        return getColor('success');
      case 'warning':
        return getColor('warning');
      case 'error':
        return getColor('error');
      default:
        return getColor('info');
    }
  };

  return (
    <div
      style={{
        backgroundColor: `${getAlertColor()}20`, // 20 is hex for 12% opacity
        borderLeft: `4px solid ${getAlertColor()}`,
        borderRadius: '4px',
        padding: '12px 16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ color: getColor('text') }}>{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            marginLeft: '16px',
            color: getAlertColor(),
            padding: '4px',
          }}
        >
          &times;
        </button>
      )}
    </div>
  );
};

// Badge Component
export const Badge: React.FC<{ children: React.ReactNode; type?: 'default' | 'primary' | 'success' | 'warning' | 'danger' }> = ({ children, type = 'default' }) => {
  const { getColor } = useTheme();

  const getBadgeColor = () => {
    switch (type) {
      case 'primary':
        return getColor('primary');
      case 'success':
        return getColor('success');
      case 'warning':
        return getColor('warning');
      case 'danger':
        return getColor('danger');
      default:
        return getColor('buttonBackground');
    }
  };

  const getBadgeTextColor = () => {
    return type === 'default' ? getColor('text') : 'white';
  };

  return (
    <span
      style={{
        backgroundColor: getBadgeColor(),
        color: getBadgeTextColor(),
        borderRadius: '16px',
        padding: '4px 10px',
        fontSize: '12px',
        fontWeight: '600',
        display: 'inline-block',
      }}
    >
      {children}
    </span>
  );
};

// Modal Component
export const Modal: React.FC<{ children: React.ReactNode; isOpen: boolean; onClose: () => void; title: string }> = ({ children, isOpen, onClose, title }) => {
  const { getColor } = useTheme();

  if (!isOpen) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: getColor('card'),
            padding: '20px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
};

// Main Component to showcase all elements
export default function DesignSystem() {
  const [radioValue, setRadioValue] = useState('');
  const [checkboxValue, setCheckboxValue] = useState(false);
  const [toggleValue, setToggleValue] = useState(false);
  const { getColor } = useTheme();

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '20px',
        backgroundColor: getColor('background'),
        color: getColor('text'),
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <h1 style={{ textAlign: 'center', marginBottom: '40px' }}>Layerz Design System</h1>

      <Card title="Buttons">
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <Button>Primary Button</Button>
          <Button style={{ backgroundColor: getColor('secondary') }}>Secondary Button</Button>
          <Button style={{ backgroundColor: getColor('danger') }}>Danger Button</Button>
        </div>

        <h3>Wide Button</h3>
        <WideButton>Wide Button</WideButton>

        <h3>Long Press Button</h3>
        <LongPressButton onComplete={() => alert('Button pressed!')}>Hold to confirm</LongPressButton>
      </Card>

      <Card title="Form Elements">
        <div style={{ marginBottom: '20px' }}>
          <Label>Text Input</Label>
          <Input placeholder="Enter text here" />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <Label>Text Area</Label>
          <TextArea placeholder="Enter longer text here..." />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <Label>Select Input</Label>
          <Select>
            <option value="">Select an option</option>
            <option value="1">Option 1</option>
            <option value="2">Option 2</option>
            <option value="3">Option 3</option>
          </Select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <Label>Radio Buttons</Label>
          <RadioButton name="radio-group" label="Option 1" checked={radioValue === '1'} onChange={() => setRadioValue('1')} />
          <RadioButton name="radio-group" label="Option 2" checked={radioValue === '2'} onChange={() => setRadioValue('2')} />
          <RadioButton name="radio-group" label="Option 3" checked={radioValue === '3'} onChange={() => setRadioValue('3')} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <Label>Checkbox</Label>
          <Checkbox label="I agree to the terms" checked={checkboxValue} onChange={() => setCheckboxValue(!checkboxValue)} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <Label>Toggle Switch</Label>
          <ToggleSwitch checked={toggleValue} onChange={() => setToggleValue(!toggleValue)} label="Enable feature" />
        </div>
      </Card>

      <Card title="Badges">
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <Badge>Default</Badge>
          <Badge type="primary">Primary</Badge>
          <Badge type="success">Success</Badge>
          <Badge type="warning">Warning</Badge>
          <Badge type="danger">Danger</Badge>
        </div>
      </Card>

      <Card title="Bubbles (Tags)">
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <Bubble>Default Bubble</Bubble>
          <Bubble active>Active Bubble</Bubble>
        </div>
      </Card>

      <Card title="Alerts">
        <Alert type="info">This is an information message.</Alert>
        <Alert type="success">This is a success message.</Alert>
        <Alert type="warning">This is a warning message.</Alert>
        <Alert type="error">This is an error message.</Alert>
      </Card>
    </div>
  );
}
