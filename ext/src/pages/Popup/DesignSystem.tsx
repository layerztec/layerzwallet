import React, { useRef, useState, useEffect } from 'react';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';
import { ClipboardCopy } from 'lucide-react';

export const SelectFeeSlider: React.FC<
  {
    onChange: (value: number) => void;
  } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>
> = ({ onChange, ...props }) => {
  return (
    <input
      type="range"
      {...props}
      min={props.min ?? 1}
      max={props.max ?? 5}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        onChange(+event.target.value);
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
  return (
    <div
      style={{
        display: 'flex',
        backgroundColor: '#f0f0f0',
        borderRadius: '8px',
        padding: '4px',
        width: '100%',
      }}
    >
      {items.map((item) => (
        <button
          key={item}
          onClick={() => onItemClick(item)}
          style={{
            flex: 1,
            padding: '8px 16px',
            border: 'none',
            borderRadius: '6px',
            backgroundColor: item === activeItem ? '#282c34' : 'transparent',
            color: item === activeItem ? 'white' : '#666',
            fontWeight: item === activeItem ? 'bold' : 'normal',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            outline: 'none',
          }}
        >
          {capitalizeFirstLetter(item)}
        </button>
      ))}
    </div>
  );
};

// Button Component
export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { disabled?: boolean }> = ({ children, disabled, style, ...props }) => (
  <button
    {...props}
    disabled={disabled}
    style={{
      backgroundColor: '#282c34',
      color: 'white',
      border: '1px solid white',
      padding: '10px 20px',
      borderRadius: '5px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: '20px',
      transition: 'background-color 0.3s',
      opacity: disabled ? 0.5 : 1,
      display: 'inline-flex',
      alignItems: 'center',
      whiteSpace: 'nowrap',
      margin: '0 5px 5px 0',
      ...style, // Merge any custom styles passed as props
    }}
  >
    {React.Children.map(children, (child) => (
      <span style={{ display: 'flex', alignItems: 'center', marginRight: '5px' }}>{child}</span>
    ))}
  </button>
);

// WideButton Component
export const WideButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { disabled?: boolean }> = ({ children, disabled, ...props }) => (
  <button
    {...props}
    disabled={disabled}
    style={{
      backgroundColor: '#282c34',
      color: 'white',
      border: '1px solid white',
      padding: '10px 20px',
      borderRadius: '5px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: '20px',
      transition: 'background-color 0.3s',
      opacity: disabled ? 0.5 : 1,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      margin: '0 5px 5px 0',
    }}
  >
    {React.Children.map(children, (child) => (
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 5px' }}>{child}</span>
    ))}
  </button>
);

export const HodlButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { disabled?: boolean; holdTime?: number; onHold?: () => void }> = ({
  children,
  disabled,
  holdTime = 2000, // default hold time is 2000 milliseconds (2 seconds)
  onHold,
  ...props
}) => {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        backgroundColor: '#282c34',
        color: 'white',
        border: '1px solid white',
        padding: '10px 20px',
        borderRadius: '5px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '20px',
        transition: 'background-color 0.3s',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        margin: '0 5px 5px 0',
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
export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    style={{
      width: '95%',
      padding: '10px',
      marginBottom: '10px',
      border: '1px solid #282c34',
      borderRadius: '5px',
      fontSize: '16px',
      color: '#282c34',
      backgroundColor: 'white',
    }}
  />
);

// TextArea Component
export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
  <textarea
    {...props}
    style={{
      width: '95%',
      padding: '10px',
      border: '1px solid #282c34',
      borderRadius: '5px',
      fontSize: '16px',
      minHeight: '100px',
      color: '#282c34',
      backgroundColor: 'white',
    }}
  />
);

// Bubble Component
export const Bubble: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      backgroundColor: '#ebebeb',
      borderRadius: '20px',
      padding: '10px 20px',
      marginBottom: '5px',
      marginRight: '5px',
      display: 'inline-block',
    }}
  >
    {children}
  </div>
);

// Radio Button Component
export const RadioButton: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
  <label
    style={{
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      color: '#282c34',
    }}
  >
    <input
      type="radio"
      {...props}
      style={{
        appearance: 'none',
        width: '20px',
        height: '20px',
        border: '2px solid #282c34',
        borderRadius: '50%',
        marginRight: '10px',
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
        background-color: #282c34;
        border-radius: 50%;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
    `}</style>
  </label>
);

// Checkbox Component
export const Checkbox: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
  <label
    style={{
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      color: '#282c34',
    }}
  >
    <input
      type="checkbox"
      {...props}
      style={{
        appearance: 'none',
        width: '20px',
        height: '20px',
        border: '2px solid #282c34',
        borderRadius: '3px',
        marginRight: '10px',
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
        color: #282c34;
        font-size: 16px;
        font-weight: bold;
      }
    `}</style>
  </label>
);

// Select Component
export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
  <select
    {...props}
    style={{
      width: '100%',
      padding: '10px',
      border: '1px solid #282c34',
      borderRadius: '5px',
      fontSize: '16px',
      backgroundColor: 'white',
      color: '#282c34',
    }}
  />
);

// Card Component
export const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      width: '95%',
      backgroundColor: 'white',
      border: '1px solid #ebebeb',
      borderRadius: '10px',
      padding: '20px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    }}
  >
    {children}
  </div>
);

// Toggle Switch Component
export const ToggleSwitch: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
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
        backgroundColor: '#ccc',
        transition: '.4s',
        borderRadius: '34px',
      }}
    />
    <style>{`
      input:checked + span {
        background-color: #282c34;
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

export const AddressBubble: React.FC<{ address: string; showCopyButton: boolean }> = ({ address, showCopyButton }) => {
  const [copied, setCopied] = useState(false);

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
          <span style={{ fontWeight: 'bold', marginRight: '1ch' }}>{firstPart}</span>
          <span>{middlePart1}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <span>{middlePart2}</span>
          <span style={{ fontWeight: 'bold', marginLeft: '1ch' }}>{lastPart}</span>
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
        marginTop: '20px',
        marginBottom: '20px',
      }}
    >
      <Bubble>
        <div
          style={{
            wordBreak: 'break-word',
            textAlign: 'left',
            padding: '10px',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {formatAddress(address)}
        </div>
      </Bubble>
      {showCopyButton ? (
        <Button onClick={handleCopyToClipboard} data-testid="copy-to-clipboard" style={{ marginLeft: '10px' }}>
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
            backgroundColor: '#333',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '16px',
            transform: 'translateX(50%)',
            boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.2)',
            opacity: 1,
            animation: 'fadeInOut 4s ease forwards',
            transition: 'all 0.5s ease',
            transformOrigin: 'center',
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
          border: '1px solid gray',
          backgroundColor: 'white',
          opacity: isVisible ? 1 : 0,
          transition: 'all 0.3s ease-in-out',
          zIndex: 1000,
          width: width,
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        {children}
      </div>
    </>
  );
};

// Main Component to showcase all elements
export default function DesignSystem() {
  const [radioValue, setRadioValue] = useState('');
  const [checkboxValue, setCheckboxValue] = useState(false);
  const [toggleValue, setToggleValue] = useState(false);

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '20px',
        backgroundColor: 'white',
        color: '#282c34',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <h1 style={{ textAlign: 'center', marginBottom: '40px' }}>Design System</h1>

      <Card>
        <h2>Buttons</h2>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <Button>Primary Button</Button>
          <Button style={{ backgroundColor: 'transparent', border: '2px solid #282c34' }}>Secondary Button</Button>
        </div>

        <h2>Inputs</h2>
        <div style={{ marginBottom: '20px' }}>
          <Input placeholder="Enter text here" />
        </div>

        <h2>TextArea</h2>
        <div style={{ marginBottom: '20px' }}>
          <TextArea placeholder="Enter longer text here" />
        </div>

        <h2>Bubbles</h2>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <Bubble>Bubble 1</Bubble>
          <Bubble>Bubble 2</Bubble>
        </div>

        <h2>Radio Buttons</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          <RadioButton label="Option 1" name="radioGroup" value="1" checked={radioValue === '1'} onChange={(e) => setRadioValue(e.target.value)} />
          <RadioButton label="Option 2" name="radioGroup" value="2" checked={radioValue === '2'} onChange={(e) => setRadioValue(e.target.value)} />
        </div>

        <h2>Checkboxes</h2>
        <div style={{ marginBottom: '20px' }}>
          <Checkbox label="Check me" checked={checkboxValue} onChange={(e) => setCheckboxValue(e.target.checked)} />
        </div>

        <h2>Select</h2>
        <div style={{ marginBottom: '20px' }}>
          <Select>
            <option value="">Select an option</option>
            <option value="1">Option 1</option>
            <option value="2">Option 2</option>
          </Select>
        </div>

        <h2>Toggle Switch</h2>
        <div style={{ marginBottom: '20px' }}>
          <ToggleSwitch checked={toggleValue} onChange={(e) => setToggleValue(e.target.checked)} />
        </div>
      </Card>
    </div>
  );
}
