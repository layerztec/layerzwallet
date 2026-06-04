import { X } from 'lucide-react';
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router';

import { useActionPopup } from '../contexts/ActionPopupContext';
import './ActionPopupModal.css';

/** Web port of mobile `ActionPopupModal`. */
const ActionPopupModal: React.FC = () => {
  const navigate = useNavigate();
  const { getActions, clearActions } = useActionPopup();
  const { actions, title } = getActions();

  const handleClose = () => {
    navigate(-1);
  };

  const handleActionPress = (action: () => void) => {
    navigate(-1);
    setTimeout(() => {
      action();
    }, 100);
  };

  useEffect(() => {
    return () => clearActions();
  }, [clearActions]);

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="action-popup-overlay" role="presentation" onClick={handleClose}>
      <div className="action-popup-sheet" role="dialog" aria-modal="true" aria-label={title ?? 'Actions'} onClick={(e) => e.stopPropagation()}>
        <div className="action-popup-header">
          <div style={{ width: 32 }} aria-hidden />
          <p className="action-popup-title">{title ?? ''}</p>
          <button type="button" className="action-popup-close" onClick={handleClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <div className="action-popup-actions">
          {actions.map((action, index) => {
            const isSection = action.variant === 'section';
            return (
              <button
                key={index}
                type="button"
                className={`action-popup-item${isSection ? ' action-popup-item--section' : ''}`}
                disabled={action.disabled || isSection}
                onClick={() => {
                  if (!action.disabled && !isSection) {
                    handleActionPress(action.onClick);
                  }
                }}
              >
                {action.children}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ActionPopupModal;
