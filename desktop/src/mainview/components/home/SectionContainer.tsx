import React from 'react';

import './SectionContainer.css';

type SectionContainerProps = {
  title?: string;
  onViewAll?: () => void;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

export const SectionContainer: React.FC<SectionContainerProps> = ({ title, onViewAll, children, className, contentClassName }) => (
  <section className={['home-section', className].filter(Boolean).join(' ')}>
    {(title || onViewAll) && (
      <div className="home-section-header">
        {title ? <h2 className="home-section-title">{title}</h2> : <span />}
        {onViewAll ? (
          <button type="button" className="home-section-view-all" onClick={onViewAll}>
            View all
          </button>
        ) : null}
      </div>
    )}
    <div className={['home-section-card', contentClassName].filter(Boolean).join(' ')}>{children}</div>
  </section>
);
