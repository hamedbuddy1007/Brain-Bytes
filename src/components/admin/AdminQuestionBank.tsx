import React, { useState } from 'react';
import { Icon } from '../Icon';
import { ROUND_1_QUESTIONS } from '../../data/round1Questions';
import { ROUND_2_QUESTIONS, type Round2Question } from '../../data/round2Questions';
import { ROUND_3_QUESTIONS } from '../../data/round3Questions';
import { GraphVisualizer } from '../rounds/GraphVisualizer';

type QuestionCategory = 'ROUND_1' | 'ROUND_2' | 'ROUND_3';

interface GenericQuestionItem {
  id: number;
  numberStr: string;
  domain: string;
  prompt: string;
  options: { key: string; label: string; subtext?: string }[];
  correctAnswer: number;
  explanation: string;
  marksStr: string;
  category: QuestionCategory;
  chartData?: Round2Question['chartData'];
}

export const AdminQuestionBank: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<QuestionCategory>('ROUND_1');
  const [searchQuery, setSearchQuery] = useState('');

  // Local state initialized from question modules
  const [questions, setQuestions] = useState<GenericQuestionItem[]>(() => {
    const q1: GenericQuestionItem[] = ROUND_1_QUESTIONS.map((q) => ({
      ...q,
      category: 'ROUND_1',
    }));
    const q2: GenericQuestionItem[] = ROUND_2_QUESTIONS.map((q) => ({
      ...q,
      category: 'ROUND_2',
    }));
    const q3: GenericQuestionItem[] = ROUND_3_QUESTIONS.map((q) => ({
      ...q,
      category: 'ROUND_3',
    }));
    return [...q1, ...q2, ...q3];
  });

  // Modal States
  const [previewQuestion, setPreviewQuestion] = useState<GenericQuestionItem | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<GenericQuestionItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New question draft
  const [newPrompt, setNewPrompt] = useState('');
  const [newDomain, setNewDomain] = useState('DATA_SCIENCE');
  const [newOptA, setNewOptA] = useState('');
  const [newOptB, setNewOptB] = useState('');
  const [newOptC, setNewOptC] = useState('');
  const [newOptD, setNewOptD] = useState('');
  const [newCorrect, setNewCorrect] = useState(0);
  const [newExplanation, setNewExplanation] = useState('');

  const currentCategoryQuestions = questions.filter((q) => q.category === activeCategory);
  const filteredQuestions = currentCategoryQuestions.filter((q) =>
    q.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = (id: number) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    setDeleteConfirmId(null);
  };

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrompt.trim() || !newOptA.trim() || !newOptB.trim()) {
      alert('Prompt and at least options A and B are required.');
      return;
    }

    const newId = Date.now();
    const newItem: GenericQuestionItem = {
      id: newId,
      numberStr: String(currentCategoryQuestions.length + 1).padStart(2, '0'),
      domain: newDomain.toUpperCase(),
      prompt: newPrompt,
      options: [
        { key: 'A', label: newOptA },
        { key: 'B', label: newOptB },
        { key: 'C', label: newOptC || 'None of the above' },
        { key: 'D', label: newOptD || 'All of the above' },
      ],
      correctAnswer: newCorrect,
      explanation: newExplanation || 'Official verification logic recorded by system administrator.',
      marksStr:
        activeCategory === 'ROUND_3'
          ? '+5.00 CORRECT / -2.00 WRONG / 0 UNANSWERED'
          : '+1.00 MARK / 0 WRONG',
      category: activeCategory,
    };

    setQuestions((prev) => [...prev, newItem]);
    setIsAddModalOpen(false);
    // Reset inputs
    setNewPrompt('');
    setNewOptA('');
    setNewOptB('');
    setNewOptC('');
    setNewOptD('');
    setNewExplanation('');
  };

  return (
    <div className="overview-container">
      {/* Header */}
      <div className="screen-header-block">
        <div className="screen-pretitle">
          <span className="red-square" />
          <span>CONTENT REPOSITORY & EXAM SYLLABUS AUDIT</span>
        </div>
        <h1 className="screen-maintitle">QUESTION BANK MANAGEMENT</h1>
      </div>

      {/* Live Exam Safety Banner */}
      <div style={{
        backgroundColor: '#292A2E',
        border: '1px solid #414047',
        borderLeft: '4px solid #F59E0B',
        padding: '12px 18px',
        borderRadius: '6px',
        fontSize: '0.8rem',
        color: '#F5F3F4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icon name="shield" size={16} style={{ color: '#F59E0B' }} />
          <span>
            <strong>LIVE-EXAM SAFETY:</strong> Modifications apply strictly to new attempts. Active candidate sessions retain their cryptographic question snapshot.
          </span>
        </div>
        <span style={{ color: '#22C55E', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.74rem' }}>
          SNAPSHOT: CRC-9F40EA12
        </span>
      </div>

      {/* Category Tabs & Add Button Bar */}
      <div className="registry-filter-bar">
        <div className="filter-left-cluster">
          <div className="state-toggles-group">
            <button
              type="button"
              className={`state-toggle-btn ${activeCategory === 'ROUND_1' ? 'is-active-live' : ''}`}
              onClick={() => setActiveCategory('ROUND_1')}
            >
              ROUND 1 — DATA MCQ ({questions.filter((q) => q.category === 'ROUND_1').length})
            </button>
            <button
              type="button"
              className={`state-toggle-btn ${activeCategory === 'ROUND_2' ? 'is-active-live' : ''}`}
              onClick={() => setActiveCategory('ROUND_2')}
            >
              ROUND 2 — GRAPH CHALLENGE ({questions.filter((q) => q.category === 'ROUND_2').length})
            </button>
            <button
              type="button"
              className={`state-toggle-btn ${activeCategory === 'ROUND_3' ? 'is-active-live' : ''}`}
              onClick={() => setActiveCategory('ROUND_3')}
            >
              ROUND 3 — RAPID FIRE ({questions.filter((q) => q.category === 'ROUND_3').length})
            </button>
          </div>

          <div className="search-input-wrapper" style={{ maxWidth: '240px' }}>
            <Icon name="search" size={13} className="search-icon-inside" />
            <input
              type="text"
              className="search-input-field"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="filter-right-cluster">
          <button
            type="button"
            className="btn-admin-primary"
            onClick={() => setIsAddModalOpen(true)}
          >
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>+</span>
            <span>ADD NEW QUESTION</span>
          </button>
        </div>
      </div>

      {/* Question Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filteredQuestions.map((q, idx) => (
          <div
            key={q.id}
            style={{
              backgroundColor: '#292A2E',
              border: '1px solid #414047',
              borderRadius: '8px',
              padding: '18px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  background: 'rgba(142, 35, 59, 0.2)',
                  border: '1px solid #8E233B',
                  color: '#F5F3F4',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 800,
                  fontSize: '0.74rem',
                  padding: '3px 8px',
                  borderRadius: '4px'
                }}>
                  ITEM #{q.numberStr || String(idx + 1).padStart(2, '0')}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.74rem', color: '#B8B2B7' }}>
                  DOMAIN: {q.domain}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.74rem', color: '#22C55E' }}>
                  {q.marksStr}
                </span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-admin-action"
                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                  onClick={() => setPreviewQuestion(q)}
                >
                  <Icon name="monitor" size={13} />
                  <span>PREVIEW</span>
                </button>
                <button
                  type="button"
                  className="btn-admin-action"
                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                  onClick={() => setEditingQuestion(q)}
                >
                  <span>EDIT</span>
                </button>
                <button
                  type="button"
                  className="btn-admin-danger"
                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                  onClick={() => setDeleteConfirmId(q.id)}
                >
                  <Icon name="trash" size={13} />
                  <span>DELETE</span>
                </button>
              </div>
            </div>

            {/* Prompt */}
            <p style={{ margin: 0, color: '#F5F3F4', fontSize: '0.98rem', fontWeight: 600, lineHeight: 1.5 }}>
              {q.prompt}
            </p>

            {/* Options Preview Pills */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
              {q.options.map((opt, optIdx) => {
                const isCorrect = optIdx === q.correctAnswer;
                return (
                  <div
                    key={opt.key}
                    style={{
                      background: isCorrect ? 'rgba(34, 197, 94, 0.12)' : '#202124',
                      border: isCorrect ? '1px solid #22C55E' : '1px solid #414047',
                      borderRadius: '6px',
                      padding: '10px 14px',
                      fontSize: '0.84rem',
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '10px'
                    }}
                  >
                    <span style={{
                      fontWeight: 800,
                      fontFamily: 'JetBrains Mono, monospace',
                      color: isCorrect ? '#22C55E' : '#B94B68'
                    }}>
                      [{opt.key}]
                    </span>
                    <span style={{ color: isCorrect ? '#22C55E' : '#F5F3F4', flex: 1 }}>
                      {opt.label}
                    </span>
                    {isCorrect && (
                      <span style={{
                        fontSize: '0.65rem',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 900,
                        color: '#22C55E'
                      }}>
                        CORRECT
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Explanation Preview */}
            {q.explanation && (
              <div style={{
                background: '#202124',
                borderLeft: '3px solid #8E233B',
                borderRadius: '0 4px 4px 0',
                padding: '8px 12px',
                fontSize: '0.78rem',
                fontFamily: 'JetBrains Mono, monospace',
                color: '#B8B2B7'
              }}>
                EXPLANATION: {q.explanation}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* PREVIEW MODAL */}
      {previewQuestion && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div style={{
            background: '#292A2E',
            border: '1px solid #414047',
            borderRadius: '8px',
            maxWidth: '640px',
            width: '100%',
            padding: '24px',
            maxHeight: '90vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#B94B68', fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: '0.8rem' }}>
                EXAM SIMULATION PREVIEW // {previewQuestion.category.replace('_', ' ')}
              </span>
              <button
                type="button"
                style={{ background: 'transparent', border: 'none', color: '#B8B2B7', fontSize: '1.2rem', cursor: 'pointer' }}
                onClick={() => setPreviewQuestion(null)}
              >
                ✕
              </button>
            </div>

            {/* If Round 2 with Chart, render the actual SVG chart! */}
            {previewQuestion.chartData && (
              <div style={{ background: '#202124', border: '1px solid #414047', borderRadius: '6px', padding: '16px' }}>
                <GraphVisualizer chartData={previewQuestion.chartData} />
              </div>
            )}

            <h3 style={{ color: '#F5F3F4', margin: 0, fontSize: '1.1rem', lineHeight: 1.45 }}>{previewQuestion.prompt}</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {previewQuestion.options.map((opt) => (
                <div
                  key={opt.key}
                  style={{
                    background: '#202124',
                    border: '1px solid #414047',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    color: '#F5F3F4',
                    fontSize: '0.88rem'
                  }}
                >
                  <strong style={{ color: '#B94B68', marginRight: '8px', fontFamily: 'JetBrains Mono, monospace' }}>
                    [{opt.key}]
                  </strong>
                  {opt.label}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                type="button"
                className="btn-admin-action"
                onClick={() => setPreviewQuestion(null)}
              >
                CLOSE PREVIEW
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD QUESTION MODAL */}
      {isAddModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div style={{
            background: '#292A2E',
            border: '1px solid #414047',
            borderRadius: '8px',
            maxWidth: '600px',
            width: '100%',
            padding: '24px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ color: '#F5F3F4', margin: '0 0 16px 0', fontSize: '1.15rem' }}>
              Add Question to {activeCategory.replace('_', ' ')}
            </h3>

            <form onSubmit={handleAddQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#B8B2B7', display: 'block', marginBottom: '6px' }}>
                  DOMAIN / TOPIC
                </label>
                <input
                  type="text"
                  className="search-input-field"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="e.g. BAYESIAN_STATS"
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#B8B2B7', display: 'block', marginBottom: '6px' }}>
                  QUESTION PROMPT
                </label>
                <textarea
                  className="search-input-field"
                  rows={3}
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  placeholder="Enter question text here..."
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#B8B2B7', display: 'block', marginBottom: '4px' }}>OPTION A</label>
                  <input
                    type="text"
                    className="search-input-field"
                    value={newOptA}
                    onChange={(e) => setNewOptA(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#B8B2B7', display: 'block', marginBottom: '4px' }}>OPTION B</label>
                  <input
                    type="text"
                    className="search-input-field"
                    value={newOptB}
                    onChange={(e) => setNewOptB(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#B8B2B7', display: 'block', marginBottom: '4px' }}>OPTION C</label>
                  <input
                    type="text"
                    className="search-input-field"
                    value={newOptC}
                    onChange={(e) => setNewOptC(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#B8B2B7', display: 'block', marginBottom: '4px' }}>OPTION D</label>
                  <input
                    type="text"
                    className="search-input-field"
                    value={newOptD}
                    onChange={(e) => setNewOptD(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#22C55E', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  CORRECT ANSWER KEY
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={newCorrect}
                  onChange={(e) => setNewCorrect(Number(e.target.value))}
                >
                  <option value={0}>Option A is Correct</option>
                  <option value={1}>Option B is Correct</option>
                  <option value={2}>Option C is Correct</option>
                  <option value={3}>Option D is Correct</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#B8B2B7', display: 'block', marginBottom: '6px' }}>
                  EXPLANATION (OPTIONAL)
                </label>
                <input
                  type="text"
                  className="search-input-field"
                  value={newExplanation}
                  onChange={(e) => setNewExplanation(e.target.value)}
                  placeholder="Reasoning for correct answer"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn-admin-action"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="btn-admin-primary"
                >
                  PUBLISH TO BANK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingQuestion && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div style={{
            background: '#292A2E',
            border: '1px solid #414047',
            borderRadius: '8px',
            maxWidth: '600px',
            width: '100%',
            padding: '24px'
          }}>
            <h3 style={{ color: '#F5F3F4', margin: '0 0 16px 0', fontSize: '1.15rem' }}>
              Edit Item #{editingQuestion.numberStr}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#B8B2B7', display: 'block', marginBottom: '6px' }}>PROMPT</label>
                <textarea
                  className="search-input-field"
                  rows={3}
                  value={editingQuestion.prompt}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, prompt: e.target.value })
                  }
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#22C55E', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  CORRECT ANSWER
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={editingQuestion.correctAnswer}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, correctAnswer: Number(e.target.value) })
                  }
                >
                  <option value={0}>Option A (0)</option>
                  <option value={1}>Option B (1)</option>
                  <option value={2}>Option C (2)</option>
                  <option value={3}>Option D (3)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn-admin-action"
                  onClick={() => setEditingQuestion(null)}
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  className="btn-admin-primary"
                  onClick={() => {
                    setQuestions((prev) =>
                      prev.map((q) => (q.id === editingQuestion.id ? editingQuestion : q))
                    );
                    setEditingQuestion(null);
                  }}
                >
                  SAVE CHANGES
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteConfirmId !== null && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div style={{
            background: '#292A2E',
            border: '1px solid #EF4444',
            borderRadius: '8px',
            maxWidth: '440px',
            width: '100%',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ color: '#EF4444', margin: 0, fontSize: '1.1rem' }}>
              Confirm Question Deletion
            </h3>
            <p style={{ color: '#B8B2B7', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
              Are you sure you want to remove this item from the active question bank? It will no longer appear in new candidate attempts.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-admin-action"
                onClick={() => setDeleteConfirmId(null)}
              >
                CANCEL
              </button>
              <button
                type="button"
                className="btn-admin-danger"
                onClick={() => handleDelete(deleteConfirmId)}
              >
                DELETE ITEM
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
