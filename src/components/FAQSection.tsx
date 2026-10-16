import React, { useState } from 'react';
import { FAQS } from '../data/mockData';
import { Icon } from './Icon';

export const FAQSection: React.FC = () => {
  const [openId, setOpenId] = useState<string | null>('faq-1');

  const toggleFaq = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <section className="section-wrapper faq-section" id="rules-section">
      <div className="section-container max-w-3xl">
        <div className="section-header text-center">
          <div className="section-kicker solar-kicker">
            <Icon name="shield" size={14} className="text-solar" />
            <span>CLARIFICATIONS</span>
          </div>
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-subtitle">
            Essential operational details for participating candidates and campus delegates.
          </p>
        </div>

        <div className="faq-list">
          {FAQS.map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <div
                key={faq.id}
                className={`faq-item-card solar-faq-item ${isOpen ? 'open' : ''}`}
              >
                <button
                  type="button"
                  className="faq-question-btn"
                  onClick={() => toggleFaq(faq.id)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${faq.id}`}
                >
                  <div className="faq-q-left">
                    <span className="faq-tag-chip solar-tag">{faq.tag}</span>
                    <span className="faq-q-text">{faq.question}</span>
                  </div>
                  <div className={`faq-icon-rotator ${isOpen ? 'rotated' : ''}`}>
                    <Icon name="chevron-down" size={18} />
                  </div>
                </button>

                {isOpen && (
                  <div
                    id={`faq-answer-${faq.id}`}
                    className="faq-answer-container"
                    role="region"
                  >
                    <p className="faq-answer-text text-muted">{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
