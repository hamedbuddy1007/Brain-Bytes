import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Icon } from '../Icon';
import { apiRequest } from '../../services/apiClient';
import type { RegistryParticipant } from '../../types/competition';

interface QuestionAnswerItem {
  id?: number;
  questionId: number;
  sortOrder?: number;
  questionNumber: number;
  prompt: string;
  options: Array<string | { key?: string; label?: string; subtext?: string }>;
  selectedOption: number | null;
  correctAnswer: number;
  isAttempted: boolean;
  isCorrect: boolean;
  status: 'CORRECT' | 'INCORRECT' | 'UNATTEMPTED';
  pointsAwarded: number;
  answeredAt?: string | null;
}

interface RoundAnswerSheet {
  roundId: number;
  attempt: {
    id: number;
    status: 'SUBMITTED' | 'IN_PROGRESS';
    startedAt: string | null;
    submittedAt: string | null;
    score: number;
    correctCount: number;
    incorrectCount: number;
    unansweredCount: number;
    timeTakenSeconds: number | null;
  } | null;
  questions: QuestionAnswerItem[];
}

interface ParticipantAnswerSheetResponse {
  participant: {
    id: number;
    fullName: string;
    rollNumber: string;
    department: string;
    yearOfStudy: string;
    approvalStatus: string;
    accessCode: string | null;
  };
  rounds: {
    1: RoundAnswerSheet;
    2: RoundAnswerSheet;
    3: RoundAnswerSheet;
  };
}

interface AdminParticipantAnswersProps {
  initialParticipantId?: string | null;
}

const OPTION_KEYS = ['A', 'B', 'C', 'D'];

export const AdminParticipantAnswers: React.FC<AdminParticipantAnswersProps> = ({
  initialParticipantId = null,
}) => {
  const [participants, setParticipants] = useState<RegistryParticipant[]>([]);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(initialParticipantId);
  const [participantSearch, setParticipantSearch] = useState<string>('');

  const [answerSheet, setAnswerSheet] = useState<ParticipantAnswerSheetResponse | null>(null);
  const [isLoadingSheet, setIsLoadingSheet] = useState<boolean>(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const [activeRound, setActiveRound] = useState<1 | 2 | 3>(1);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ATTEMPTED' | 'CORRECT' | 'INCORRECT' | 'UNATTEMPTED'>('ALL');
  const [questionSearch, setQuestionSearch] = useState<string>('');

  // Sync if parent passes a new initialParticipantId
  useEffect(() => {
    if (initialParticipantId) {
      setSelectedParticipantId(initialParticipantId);
    }
  }, [initialParticipantId]);

  const loadParticipants = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const list = await apiRequest<RegistryParticipant[]>('/admin/participants');
      const validList = list || [];
      setParticipants(validList);
      setSelectedParticipantId((prev) => {
        if (prev && validList.some((p) => String(p.id) === String(prev))) {
          return prev;
        }
        return validList.length > 0 ? String(validList[0].id) : null;
      });
    } catch {
      setParticipants([]);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadParticipants();
  }, [loadParticipants]);

  const fetchAnswerSheet = useCallback(async (participantId: string) => {
    setIsLoadingSheet(true);
    setSheetError(null);
    try {
      const data = await apiRequest<ParticipantAnswerSheetResponse>(`/admin/participants/${participantId}/answers`);
      setAnswerSheet(data);
    } catch (err: unknown) {
      setSheetError(err instanceof Error ? err.message : 'Failed to load participant answer sheet.');
      setAnswerSheet(null);
    } finally {
      setIsLoadingSheet(false);
    }
  }, []);

  useEffect(() => {
    if (selectedParticipantId) {
      void fetchAnswerSheet(selectedParticipantId);
    } else {
      setAnswerSheet(null);
    }
  }, [selectedParticipantId, fetchAnswerSheet]);

  const filteredParticipants = useMemo(() => {
    const q = participantSearch.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.rollNumber.toLowerCase().includes(q) ||
        (p.department || '').toLowerCase().includes(q)
    );
  }, [participants, participantSearch]);

  const currentRoundData: RoundAnswerSheet | null = answerSheet?.rounds?.[activeRound] || null;

  const filteredQuestions = useMemo(() => {
    if (!currentRoundData?.questions) return [];
    return currentRoundData.questions.filter((q) => {
      if (statusFilter === 'ATTEMPTED' && !q.isAttempted) return false;
      if (statusFilter === 'CORRECT' && q.status !== 'CORRECT') return false;
      if (statusFilter === 'INCORRECT' && q.status !== 'INCORRECT') return false;
      if (statusFilter === 'UNATTEMPTED' && q.status !== 'UNATTEMPTED') return false;

      if (questionSearch.trim()) {
        const s = questionSearch.trim().toLowerCase();
        const matchesNum = `q${q.questionNumber}`.includes(s) || String(q.questionNumber) === s;
        const matchesPrompt = (q.prompt || '').toLowerCase().includes(s);
        if (!matchesNum && !matchesPrompt) return false;
      }
      return true;
    });
  }, [currentRoundData, statusFilter, questionSearch]);

  const formatDuration = (seconds?: number | null) => {
    if (seconds === null || seconds === undefined || isNaN(Number(seconds))) return '--';
    const mins = Math.floor(Number(seconds) / 60);
    const secs = Math.floor(Number(seconds) % 60);
    return `${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  };

  return (
    <div className="overview-container">
      {/* Header */}
      <div
        className="screen-header-block"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}
      >
        <div>
          <h1 className="screen-maintitle">Participant Answer Sheets</h1>
          <p className="screen-subtitle">
            Individually inspect every participant&apos;s selected answers, correct keys, and question-by-question points across Round 1, Round 2 &amp; Round 3
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {selectedParticipantId && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fetchAnswerSheet(selectedParticipantId)}
              disabled={isLoadingSheet}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon name="refresh" size={15} />
              <span>{isLoadingSheet ? 'Refreshing...' : 'Refresh Answer Sheet'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Two-Column Responsive Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(270px, 320px) minmax(0, 1fr)',
          gap: '20px',
          alignItems: 'start',
        }}
        className="answer-inspector-grid"
      >
        {/* LEFT COLUMN: Participant Selector List */}
        <div
          className="registry-table-card"
          style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxHeight: '78vh',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.08em', color: '#94A3B8', textTransform: 'uppercase' }}>
              Select Candidate ({filteredParticipants.length})
            </span>
            <button
              type="button"
              onClick={loadParticipants}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38BDF8',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>

          <div className="search-input-wrapper" style={{ width: '100%' }}>
            <Icon name="search" size={14} className="search-icon-inside" />
            <input
              type="text"
              className="search-input-field"
              placeholder="Search name or roll number..."
              value={participantSearch}
              onChange={(e) => setParticipantSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div
            style={{
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              paddingRight: '4px',
            }}
          >
            {isLoadingList ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Loading candidates...
              </div>
            ) : filteredParticipants.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No matching candidates found.
              </div>
            ) : (
              filteredParticipants.map((p) => {
                const isSelected = String(p.id) === String(selectedParticipantId);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedParticipantId(String(p.id))}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: isSelected ? '1px solid #38BDF8' : '1px solid rgba(255,255,255,0.07)',
                      background: isSelected ? 'rgba(56, 189, 248, 0.14)' : 'rgba(15, 23, 42, 0.65)',
                      color: '#F8FAFC',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '0.86rem',
                          color: isSelected ? '#38BDF8' : '#F8FAFC',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {p.name}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#94A3B8', fontFamily: 'monospace' }}>
                        {p.rollNumber} • {p.department || 'CSE'}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: '999px',
                        background: 'rgba(255,255,255,0.06)',
                        color: '#E2E8F0',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {p.totalScore ?? 0} pts
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Individual Answer Sheet Inspector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          {sheetError && (
            <div className="form-error-alert" role="alert">
              <Icon name="alert-circle" size={18} />
              <span>{sheetError}</span>
            </div>
          )}

          {!selectedParticipantId ? (
            <div className="registry-table-card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Select a participant from the left roster to inspect their question-by-question answers.
            </div>
          ) : isLoadingSheet && !answerSheet ? (
            <div className="registry-table-card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading question-by-question answer sheet...
            </div>
          ) : answerSheet ? (
            <>
              {/* Candidate Summary Card */}
              <div
                className="registry-table-card"
                style={{
                  padding: '18px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#F8FAFC' }}>
                      {answerSheet.participant.fullName}
                    </h2>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'rgba(56, 189, 248, 0.14)',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        color: '#38BDF8',
                        fontWeight: 700,
                      }}
                    >
                      {answerSheet.participant.rollNumber}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#94A3B8', marginTop: '4px' }}>
                    Department: <strong>{answerSheet.participant.department}</strong> • Year:{' '}
                    <strong>{answerSheet.participant.yearOfStudy}</strong> • Access Code:{' '}
                    <code style={{ color: '#38BDF8', fontWeight: 700 }}>{answerSheet.participant.accessCode || '—'}</code>
                  </div>
                </div>

                {/* Round Switcher Tabs */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {([1, 2, 3] as const).map((rId) => {
                    const rSheet = answerSheet.rounds[rId];
                    const isActive = activeRound === rId;
                    const rAttempt = rSheet?.attempt;
                    return (
                      <button
                        key={rId}
                        type="button"
                        onClick={() => setActiveRound(rId)}
                        style={{
                          padding: '9px 14px',
                          borderRadius: '10px',
                          border: isActive ? '1px solid #38BDF8' : '1px solid rgba(255,255,255,0.1)',
                          background: isActive ? 'rgba(56, 189, 248, 0.18)' : 'rgba(15, 23, 42, 0.7)',
                          color: isActive ? '#38BDF8' : '#E2E8F0',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: '2px',
                        }}
                      >
                        <span style={{ fontSize: '0.82rem', fontWeight: 800 }}>
                          Round {rId} ({rSheet?.questions?.length || 0} Qs)
                        </span>
                        <span style={{ fontSize: '0.72rem', color: rAttempt ? '#4ADE80' : '#94A3B8' }}>
                          {rAttempt
                            ? `${rAttempt.status} • ${rAttempt.score} PTS`
                            : 'No Attempt Started'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Round Attempt Telemetry Strip */}
              {currentRoundData && (
                <div
                  className="registry-table-card"
                  style={{
                    padding: '14px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '14px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>
                        Round {activeRound} Status
                      </div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 800, color: currentRoundData.attempt ? '#38BDF8' : '#94A3B8' }}>
                        {currentRoundData.attempt ? currentRoundData.attempt.status : 'NOT STARTED'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>
                        Verified Score
                      </div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#F8FAFC' }}>
                        {currentRoundData.attempt ? `${currentRoundData.attempt.score} PTS` : '0 PTS'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>
                        Correct
                      </div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#22C55E' }}>
                        {currentRoundData.attempt?.correctCount ?? 0}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>
                        Incorrect
                      </div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#EF4444' }}>
                        {currentRoundData.attempt?.incorrectCount ?? 0}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>
                        Unattempted
                      </div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#94A3B8' }}>
                        {currentRoundData.attempt?.unansweredCount ?? currentRoundData.questions.length}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>
                        Time Taken
                      </div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#E2E8F0', fontFamily: 'monospace' }}>
                        {formatDuration(currentRoundData.attempt?.timeTakenSeconds)}
                      </div>
                    </div>
                  </div>

                  {/* Question Filter Controls */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="state-toggles-group" role="group" aria-label="Filter questions by answer status">
                      {(['ALL', 'ATTEMPTED', 'CORRECT', 'INCORRECT', 'UNATTEMPTED'] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          className={`state-toggle-btn ${statusFilter === f ? 'is-active-btn' : ''}`}
                          onClick={() => setStatusFilter(f)}
                        >
                          {f === 'ALL'
                            ? 'All'
                            : f === 'ATTEMPTED'
                              ? 'Attempted'
                              : f === 'CORRECT'
                                ? 'Correct'
                                : f === 'INCORRECT'
                                  ? 'Incorrect'
                                  : 'Unattempted'}
                        </button>
                      ))}
                    </div>

                    <div className="search-input-wrapper" style={{ minWidth: '180px' }}>
                      <Icon name="search" size={14} className="search-icon-inside" />
                      <input
                        type="text"
                        className="search-input-field"
                        placeholder="Filter Q# or text..."
                        value={questionSearch}
                        onChange={(e) => setQuestionSearch(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Question-by-Question List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredQuestions.length === 0 ? (
                  <div className="registry-table-card" style={{ padding: '36px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No questions match the selected filter in Round {activeRound}.
                  </div>
                ) : (
                  filteredQuestions.map((q) => {
                    const isCorrect = q.status === 'CORRECT';
                    const isIncorrect = q.status === 'INCORRECT';

                    const badgeColor = isCorrect
                      ? { bg: 'rgba(34, 197, 94, 0.14)', border: 'rgba(34, 197, 94, 0.4)', text: '#4ADE80', label: `✓ CORRECT (+${q.pointsAwarded} PTS)` }
                      : isIncorrect
                        ? { bg: 'rgba(239, 68, 68, 0.14)', border: 'rgba(239, 68, 68, 0.4)', text: '#F87171', label: `✗ INCORRECT (${q.pointsAwarded} PTS)` }
                        : { bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)', text: '#94A3B8', label: '○ UNATTEMPTED (0 PTS)' };

                    return (
                      <div
                        key={q.questionId}
                        className="registry-table-card"
                        style={{
                          padding: '16px 20px',
                          borderLeft: isCorrect
                            ? '4px solid #22C55E'
                            : isIncorrect
                              ? '4px solid #EF4444'
                              : '4px solid rgba(148, 163, 184, 0.35)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '12px',
                            marginBottom: '12px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', flex: 1 }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 900,
                                fontSize: '0.85rem',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: 'rgba(56, 189, 248, 0.15)',
                                color: '#38BDF8',
                              }}
                            >
                              Q{String(q.questionNumber).padStart(2, '0')}
                            </span>
                            <span style={{ fontSize: '0.94rem', fontWeight: 700, color: '#F8FAFC', lineHeight: 1.5 }}>
                              {q.prompt}
                            </span>
                          </div>

                          <span
                            style={{
                              fontSize: '0.73rem',
                              fontWeight: 800,
                              padding: '4px 10px',
                              borderRadius: '999px',
                              background: badgeColor.bg,
                              border: `1px solid ${badgeColor.border}`,
                              color: badgeColor.text,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {badgeColor.label}
                          </span>
                        </div>

                        {/* Options Grid */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                            gap: '8px',
                          }}
                        >
                          {(q.options || []).map((optItem, optIdx) => {
                            const isSelectedByParticipant = q.selectedOption === optIdx;
                            const isCorrectOption = q.correctAnswer === optIdx;
                            const optLabel =
                              typeof optItem === 'string'
                                ? optItem
                                : optItem?.label ?? String(optItem ?? '');
                            const optKey =
                              typeof optItem === 'object' && optItem?.key
                                ? optItem.key
                                : OPTION_KEYS[optIdx] || String(optIdx + 1);

                            let optBg = 'rgba(15, 23, 42, 0.6)';
                            let optBorder = 'rgba(255, 255, 255, 0.08)';
                            let optTextColor = '#CBD5E1';

                            if (isCorrectOption) {
                              optBg = 'rgba(34, 197, 94, 0.14)';
                              optBorder = 'rgba(34, 197, 94, 0.45)';
                              optTextColor = '#F0FDF4';
                            } else if (isSelectedByParticipant && !isCorrectOption) {
                              optBg = 'rgba(239, 68, 68, 0.14)';
                              optBorder = 'rgba(239, 68, 68, 0.45)';
                              optTextColor = '#FEF2F2';
                            }

                            return (
                              <div
                                key={optIdx}
                                style={{
                                  padding: '10px 12px',
                                  borderRadius: '8px',
                                  background: optBg,
                                  border: `1px solid ${optBorder}`,
                                  color: optTextColor,
                                  fontSize: '0.84rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-between',
                                  gap: '6px',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                  <strong style={{ fontFamily: 'monospace', color: isCorrectOption ? '#4ADE80' : isSelectedByParticipant ? '#F87171' : '#94A3B8' }}>
                                    {optKey}.
                                  </strong>
                                  <span style={{ lineHeight: 1.4 }}>{optLabel}</span>
                                </div>

                                {(isSelectedByParticipant || isCorrectOption) && (
                                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                                    {isSelectedByParticipant && (
                                      <span
                                        style={{
                                          fontSize: '0.68rem',
                                          fontWeight: 800,
                                          padding: '2px 7px',
                                          borderRadius: '4px',
                                          background: isCorrectOption ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)',
                                          color: isCorrectOption ? '#4ADE80' : '#FCA5A5',
                                          letterSpacing: '0.04em',
                                        }}
                                      >
                                        CANDIDATE SELECTED
                                      </span>
                                    )}
                                    {isCorrectOption && (
                                      <span
                                        style={{
                                          fontSize: '0.68rem',
                                          fontWeight: 800,
                                          padding: '2px 7px',
                                          borderRadius: '4px',
                                          background: 'rgba(34, 197, 94, 0.22)',
                                          color: '#4ADE80',
                                          letterSpacing: '0.04em',
                                        }}
                                      >
                                        ✓ CORRECT ANSWER
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

