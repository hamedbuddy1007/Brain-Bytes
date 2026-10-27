import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query, withTransaction } from './db.js';
import { clearSession, issueSession, requireAuth, extractAuth } from './auth.js';

export const router = Router();
const roundSchema = z.number().int().min(1).max(3);

async function assertRoundQualification(client, participantId, roundId) {
  if (roundId === 1) return;

  const sourceRound = roundId - 1;

  const sourceAttempt = await client.query(
    `SELECT 1
       FROM attempts
      WHERE participant_id = $1
        AND round_id = $2
        AND submitted_at IS NOT NULL
      LIMIT 1`,
    [participantId, sourceRound],
  );

  if (!sourceAttempt.rowCount) {
    throw Object.assign(
      new Error(
        `Submit Round ${sourceRound} before entering Round ${roundId}.`,
      ),
      { status: 403 },
    );
  }

  const qualification = await client.query(
    `SELECT
       EXISTS (
         SELECT 1
           FROM audit_events
          WHERE event_type = 'qualification.executed'
            AND details->>'sourceRound' = $1
       ) AS qualification_executed,
       EXISTS (
         SELECT 1
           FROM audit_events
          WHERE event_type = $2
            AND details->>'sourceRound' = $1
            AND details->>'participantId' = $3
       ) AS participant_qualified`,
    [
      String(sourceRound),
      `round${roundId}.qualified`,
      String(participantId),
    ],
  );

  const eligibility = qualification.rows[0];

  if (!eligibility?.qualification_executed) {
    throw Object.assign(
      new Error(
        `Round ${sourceRound} qualification has not been completed.`,
      ),
      { status: 423 },
    );
  }

  if (!eligibility.participant_qualified) {
    throw Object.assign(
      new Error(`You did not qualify for Round ${roundId}.`),
      { status: 403 },
    );
  }
}



function generateAccessCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = 'BB-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const participantRegisterSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  rollNumber: z.string().trim().min(1).max(50),
  department: z.string().trim().min(1).max(60).optional(),
  yearOfStudy: z.string().trim().min(1).max(30).optional(),
  collegeName: z.string().trim().min(2).max(160).optional(),
});

router.get('/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'unavailable' });
  }
});

router.post('/auth/admin/login', async (req, res, next) => {
  try {
    const body = z.object({
      identifier: z.string().trim().min(1).max(254),
      password: z.string().min(1).max(256),
    }).safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: 'Enter your username/email and password.' });
    }
    const { identifier, password } = body.data;

    // Secure authentication against database bcrypt password_hash
    const adminResult = await query(
      'SELECT id, username, email, password_hash FROM admins WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1) LIMIT 1',
      [identifier]
    );

    if (!adminResult.rowCount) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const adminRecord = adminResult.rows[0];
    const passwordValid = await bcrypt.compare(password, adminRecord.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const adminId = Number(adminRecord.id);
    const token = issueSession(res, { id: adminId, role: 'admin' });
    await query('INSERT INTO audit_events(actor_type, actor_id, event_type) VALUES ($1,$2,$3)', [
      'admin',
      adminId,
      'admin.login',
    ]);

    res.json({
      token,
      id: adminId,
      username: adminRecord.username,
      email: adminRecord.email,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/auth/logout', (_req, res) => {
  clearSession(res, 'admin');
  clearSession(res, 'participant');
  res.status(204).end();
});

router.get('/auth/admin/me', requireAuth('admin'), async (req, res, next) => {
  try {
    const result = await query('SELECT id, username, email FROM admins WHERE id = $1', [req.auth.id]);
    if (!result.rowCount) {
      return res.status(401).json({ error: 'Admin session expired' });
    }
    const admin = result.rows[0];
    res.json({ id: Number(admin.id), username: admin.username, email: admin.email });
  } catch (error) {
    next(error);
  }
});

// Participant Registration: Creates a PENDING registration awaiting admin approval
router.post('/participants/register', async (req, res, next) => {
  try {
    const parsed = participantRegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message || 'Check the participant details and try again.';
      return res.status(400).json({ error: issue });
    }
    const p = parsed.data;
    const normalizedRoll = p.rollNumber.trim().toUpperCase();
    const normalizedName = p.fullName.trim();
    const department = p.department?.trim() || 'CSE';
    const yearOfStudy = p.yearOfStudy?.trim() || '1st Year';
    const college = p.collegeName?.trim() || 'Department of Technical Education';

    const existingResult = await query(
      'SELECT id, full_name, roll_number, college_name, department, year_of_study, ticket_id, assigned_seat, access_code, approval_status, created_at FROM participants WHERE UPPER(roll_number)=UPPER($1) LIMIT 1',
      [normalizedRoll],
    );

    if (existingResult.rowCount) {
      const existing = existingResult.rows[0];
      if (existing.approval_status === 'APPROVED') {
        return res.json({
          status: 'APPROVED',
          approvalStatus: 'APPROVED',
          id: Number(existing.id),
          fullName: existing.full_name,
          rollNumber: existing.roll_number,
          accessCode: existing.access_code,
          department: existing.department,
          yearOfStudy: existing.year_of_study,
          message: 'Your registration is already approved! Use your Access Code to enter the arena.',
        });
      }
      return res.json({
        status: 'PENDING',
        approvalStatus: existing.approval_status || 'PENDING',
        id: Number(existing.id),
        fullName: existing.full_name,
        rollNumber: existing.roll_number,
        accessCode: null,
        department: existing.department,
        yearOfStudy: existing.year_of_study,
        message: 'Registration is pending administrator approval.',
      });
    }

    // Generate unique access code
    let accessCode = generateAccessCode();
    for (let attempts = 0; attempts < 10; attempts++) {
      const codeCheck = await query('SELECT id FROM participants WHERE access_code = $1', [accessCode]);
      if (codeCheck.rowCount === 0) break;
      accessCode = generateAccessCode();
    }

    const insertResult = await query(
      `INSERT INTO participants(full_name, roll_number, college_name, department, year_of_study, access_code, approval_status)
       VALUES($1, $2, $3, $4, $5, $6, 'PENDING')
       RETURNING id, full_name, roll_number, college_name, department, year_of_study, access_code, approval_status, created_at`,
      [normalizedName, normalizedRoll, college, department, yearOfStudy, accessCode],
    );

    const participant = insertResult.rows[0];
    const ticketId = `BB-26-${String(participant.id).padStart(4, '0')}`;
    const assignedSeat = `Station #${((Number(participant.id) - 1) % 120) + 1}`;

    await query('UPDATE participants SET ticket_id=$1, assigned_seat=$2 WHERE id=$3', [ticketId, assignedSeat, participant.id]);

    await query('INSERT INTO audit_events(actor_type, actor_id, event_type, details) VALUES ($1,$2,$3,$4)', [
      'participant',
      participant.id,
      'participant.registered',
      JSON.stringify({ rollNumber: participant.roll_number, accessCode }),
    ]);

    res.status(201).json({
      status: 'PENDING',
      approvalStatus: 'PENDING',
      id: Number(participant.id),
      fullName: participant.full_name,
      rollNumber: participant.roll_number,
      department: participant.department,
      yearOfStudy: participant.year_of_study,
      accessCode: null,
      message: 'Registration submitted successfully! Please wait while an administrator approves your entry.',
    });
  } catch (error) {
    next(error);
  }
});

// Check registration approval status (polled by registration page)
router.get('/participants/registration-status/:rollNumber', async (req, res, next) => {
  try {
    const roll = req.params.rollNumber.trim().toUpperCase();
    const result = await query(
      'SELECT id, full_name, roll_number, college_name, department, year_of_study, access_code, approval_status FROM participants WHERE UPPER(roll_number)=UPPER($1) LIMIT 1',
      [roll],
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: 'Registration not found.' });
    }
    const p = result.rows[0];
    res.json({
      id: Number(p.id),
      fullName: p.full_name,
      rollNumber: p.roll_number,
      department: p.department,
      yearOfStudy: p.year_of_study,
      approvalStatus: p.approval_status || 'PENDING',
      accessCode: p.approval_status === 'APPROVED' ? p.access_code : null,
    });
  } catch (error) {
    next(error);
  }
});

// Participant Login with Access Code (BB-XXXX)
router.post('/participants/login-access-code', async (req, res, next) => {
  try {
    const body = z.object({
      accessCode: z.string().trim().min(2).max(20),
    }).safeParse(req.body);

    if (!body.success) {
      return res.status(400).json({ error: 'Enter your valid Access Code (e.g. BB-XXXX).' });
    }

    const code = body.data.accessCode.trim().toUpperCase();
    const result = await query(
      'SELECT id, full_name, roll_number, college_name, department, year_of_study, ticket_id, assigned_seat, access_code, approval_status, created_at FROM participants WHERE UPPER(access_code)=UPPER($1) LIMIT 1',
      [code],
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Invalid Access Code. Please check your code or register first.' });
    }

    const participant = result.rows[0];
    if (participant.approval_status !== 'APPROVED') {
      return res.status(403).json({
        error: 'Your registration is still awaiting administrator approval. Please wait for the admin to accept your entry.',
        approvalStatus: participant.approval_status,
      });
    }

    const token = issueSession(res, { id: participant.id, role: 'participant' });
    await query('INSERT INTO audit_events(actor_type, actor_id, event_type, details) VALUES ($1,$2,$3,$4)', [
      'participant',
      participant.id,
      'participant.access_code_login',
      JSON.stringify({ rollNumber: participant.roll_number, accessCode: code }),
    ]);

    const attemptsResult = await query(
      'SELECT id, round_id, started_at, deadline_at, submitted_at, score, correct_count, incorrect_count, unanswered_count, time_taken_seconds FROM attempts WHERE participant_id=$1 ORDER BY round_id ASC',
      [participant.id],
    );

    res.json({
      token,
      id: Number(participant.id),
      fullName: participant.full_name,
      rollNumber: participant.roll_number,
      department: participant.department,
      yearOfStudy: participant.year_of_study,
      accessCode: participant.access_code,
      collegeName: participant.college_name,
      ticketId: participant.ticket_id || `BB-26-${String(participant.id).padStart(4, '0')}`,
      assignedSeat: participant.assigned_seat || `Station #${((Number(participant.id) - 1) % 120) + 1}`,
      registeredAt: participant.created_at,
      status: 'verified',
      attempts: attemptsResult.rows,
    });
  } catch (error) {
    next(error);
  }
});

// Re-authentication requires proof of an active session.
router.post('/participants/reauth', async (req, res, next) => {
  try {
    const session = extractAuth(req, 'participant');
    if (!session) {
      return res.status(401).json({
        error: 'Cannot re-authenticate without an active session. Please log in with your Access Code.',
      });
    }

    const { rollNumber } = req.body || {};

    const result = await query(
      'SELECT id, full_name, roll_number, college_name, department, year_of_study, ticket_id, assigned_seat, access_code, approval_status, created_at FROM participants WHERE id=$1',
      [session.id],
    );

    if (!result.rowCount) {
      return res.status(401).json({ error: 'Participant session expired.' });
    }

    const participant = result.rows[0];

    // If a roll number was supplied, verify it matches the authenticated session
    if (rollNumber && participant.roll_number.toUpperCase() !== String(rollNumber).trim().toUpperCase()) {
      return res.status(403).json({ error: 'Session does not match the requested roll number.' });
    }

    const token = issueSession(res, { id: participant.id, role: 'participant' });

    res.json({
      token,
      id: Number(participant.id),
      fullName: participant.full_name,
      rollNumber: participant.roll_number,
      department: participant.department,
      yearOfStudy: participant.year_of_study,
      accessCode: participant.access_code,
      collegeName: participant.college_name,
      ticketId: participant.ticket_id,
      assignedSeat: participant.assigned_seat,
      status: 'verified',
    });
  } catch (error) {
    next(error);
  }
});

router.get('/participants/me', requireAuth('participant'), async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, full_name, roll_number, college_name, department, year_of_study, ticket_id, assigned_seat, access_code, approval_status, created_at FROM participants WHERE id=$1',
      [req.auth.id],
    );
    if (!result.rowCount) return res.status(401).json({ error: 'Participant session expired.' });
    const participant = result.rows[0];

    const attemptsResult = await query(
      'SELECT id, round_id, started_at, deadline_at, submitted_at, score, correct_count, incorrect_count, unanswered_count, time_taken_seconds FROM attempts WHERE participant_id=$1 ORDER BY round_id ASC',
      [participant.id],
    );

    res.json({
      id: Number(participant.id),
      fullName: participant.full_name,
      rollNumber: participant.roll_number,
      department: participant.department,
      yearOfStudy: participant.year_of_study,
      accessCode: participant.access_code,
      approvalStatus: participant.approval_status,
      collegeName: participant.college_name,
      ticketId: participant.ticket_id || `BB-26-${String(participant.id).padStart(4, '0')}`,
      assignedSeat: participant.assigned_seat || `Station #${((Number(participant.id) - 1) % 120) + 1}`,
      registeredAt: participant.created_at,
      attempts: attemptsResult.rows.map((row) => ({
        id: Number(row.id),
        roundId: Number(row.round_id),
        round_id: Number(row.round_id),
        startedAt: row.started_at,
        deadlineAt: row.deadline_at,
        submittedAt: row.submitted_at,
        submitted_at: row.submitted_at,
        score: row.score,
        correctCount: row.correct_count,
        incorrectCount: row.incorrect_count,
        unansweredCount: row.unanswered_count,
        timeTakenSeconds: row.time_taken_seconds,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/participants/proctor-event', requireAuth('participant'), async (req, res, next) => {
  try {
    const { eventType, details } = req.body || {};
    await query('INSERT INTO audit_events(actor_type, actor_id, event_type, details) VALUES ($1,$2,$3,$4)', [
      'participant',
      req.auth.id,
      eventType || 'proctor.blur',
      JSON.stringify(details || {}),
    ]);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/competition/state', async (_req, res, next) => {
  try {
    const result = await query('SELECT status, active_round, registration_open, round_states, round_durations, broadcast_message, broadcast_timestamp, updated_at FROM competition_state WHERE singleton=TRUE');
    const row = result.rows[0] || {};
    res.json({
      ...row,
      broadcastMessage: row.broadcast_message || null,
      broadcastTimestamp: row.broadcast_timestamp || null,
    });
  } catch (error) {
    next(error);
  }
});

// Official answer keys are returned only to authenticated administrators.
router.get('/admin/question-bank', requireAuth('admin'), async (_req, res, next) => {
  try {
    const result = await query(`
      SELECT id, round_id, prompt, options, correct_answer, explanation,
             sort_order, chart_data, enabled, points_correct, points_wrong
      FROM questions
      ORDER BY round_id ASC, sort_order ASC
    `);
    res.set('Cache-Control', 'no-store, private');
    res.json({
      questions: result.rows.map((row) => ({
        id: Number(row.id),
        roundId: Number(row.round_id),
        prompt: row.prompt,
        options: row.options,
        correctAnswer: Number(row.correct_answer),
        explanation: row.explanation || '',
        sortOrder: Number(row.sort_order),
        chartData: row.chart_data || null,
        enabled: Boolean(row.enabled),
        pointsCorrect: Number(row.points_correct),
        pointsWrong: Number(row.points_wrong),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/rounds/:roundId/questions', async (req, res, next) => {
  try {
    const roundId = Number(req.params.roundId);
    if (!roundSchema.safeParse(roundId).success) return res.status(400).json({ error: 'Invalid round' });
    const state = await query('SELECT status, round_states FROM competition_state WHERE singleton=TRUE');
    const roundStates = state.rows[0]?.round_states || {};
    const isLocked = roundStates[String(roundId)] === 'locked' || roundStates[roundId] === 'locked';
    if (isLocked) return res.status(423).json({ error: 'This round is locked.' });
    const result = await query('SELECT id, prompt, options, sort_order, chart_data FROM questions WHERE round_id=$1 AND enabled=TRUE ORDER BY sort_order', [roundId]);
    res.json({ roundId, questions: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/rounds/:roundId/attempts/start', requireAuth('participant'), async (req, res, next) => {
  try {
    const roundId = Number(req.params.roundId);
    if (!roundSchema.safeParse(roundId).success) return res.status(400).json({ error: 'Invalid round.' });
    const participantId = req.auth.id;
    const defaultDurations = { 1: 600, 2: 600, 3: 180 };

    const attempt = await withTransaction(async (client) => {
      const participant = await client.query('SELECT id FROM participants WHERE id=$1', [participantId]);
      if (!participant.rowCount) throw Object.assign(new Error('Participant not found.'), { status: 404 });

      // Check for existing attempt first
      const existing = await client.query(
        'SELECT id, round_id, started_at, deadline_at, submitted_at, score, correct_count, incorrect_count, unanswered_count, time_taken_seconds FROM attempts WHERE participant_id=$1 AND round_id=$2',
        [participantId, roundId],
      );
      if (existing.rowCount) {
        const row = existing.rows[0];
        if (row.submitted_at) {
          const reviewQuestions = await client.query('SELECT id, sort_order, correct_answer, explanation FROM questions WHERE round_id=$1 AND enabled=TRUE ORDER BY sort_order', [roundId]);
          const userAnswersResult = await client.query(
            'SELECT a.question_id, q.sort_order, a.selected_option FROM answers a JOIN questions q ON q.id=a.question_id WHERE a.attempt_id=$1',
            [row.id]
          );
          const userAnswers = {};
          for (const r of userAnswersResult.rows) {
            userAnswers[r.question_id] = r.selected_option;
            if (r.sort_order !== null && r.sort_order !== undefined) {
              userAnswers[r.sort_order] = r.selected_option;
            }
          }
          return {
            ...row,
            alreadySubmitted: true,
            message: 'Response Already Submitted',
            review: reviewQuestions.rows.map((q) => ({
              id: Number(q.id),
              sort_order: Number(q.sort_order),
              correct_answer: q.correct_answer,
              explanation: q.explanation || null,
            })),
            answers: userAnswers,
          };

        }

        // Block resuming an unfinished attempt if the participant is not qualified.
        await assertRoundQualification(client, participantId, roundId);
        return row;
      }

      const state = await client.query('SELECT status, active_round, round_states, round_durations FROM competition_state WHERE singleton=TRUE FOR SHARE');

      const current = state.rows[0];
      const roundStates = current?.round_states || {};
      const isRoundActive = roundStates[String(roundId)] === 'active' || roundStates[roundId] === 'active';

      if (!current || current.status === 'PAUSED' || current.status === 'COMPLETED' || !isRoundActive) {
        throw Object.assign(new Error('This round is not currently open.'), { status: 423 });
      }

      // A participant must qualify before a new attempt can be created.
      await assertRoundQualification(client, participantId, roundId);

      const roundDurations = current?.round_durations || {};

      const durationSeconds = Number(roundDurations[String(roundId)] || roundDurations[roundId] || defaultDurations[roundId] || 600);

      const result = await client.query(
        `INSERT INTO attempts(participant_id, round_id, started_at, deadline_at)
         VALUES($1, $2, NOW(), NOW() + ($3 * INTERVAL '1 second'))
         ON CONFLICT (participant_id, round_id) DO UPDATE SET round_id = EXCLUDED.round_id
         RETURNING id, round_id, started_at, deadline_at, submitted_at, score, correct_count, incorrect_count, unanswered_count`,
        [participantId, roundId, durationSeconds],
      );
      return result.rows[0];
    });

    const clock = await query('SELECT NOW() AS now');
    res.status(200).json({ ...attempt, server_now: clock.rows[0].now });
  } catch (error) {
    next(error);
  }
});

router.post('/attempts/:attemptId/submit', requireAuth('participant'), async (req, res, next) => {
  try {
    const attemptId = Number(req.params.attemptId);
    const answers = z.array(z.object({
      questionId: z.coerce.number().int().positive().optional(),
      id: z.coerce.number().int().positive().optional(),
      sortOrder: z.coerce.number().int().positive().optional(),
      sort_order: z.coerce.number().int().positive().optional(),
      selectedOption: z.coerce.number().int().nonnegative().nullable().optional(),
      selected_option: z.coerce.number().int().nonnegative().nullable().optional(),
    })).max(100).safeParse(req.body?.answers);
    if (!Number.isSafeInteger(attemptId) || attemptId < 1 || !answers.success) {
      return res.status(400).json({ error: 'Invalid submission.' });
    }

    const result = await withTransaction(async (client) => {
      const attemptResult = await client.query('SELECT * FROM attempts WHERE id=$1 FOR UPDATE', [attemptId]);
      const attempt = attemptResult.rows[0];
      if (!attempt) throw Object.assign(new Error('Attempt not found.'), { status: 404 });
      if (Number(attempt.participant_id) !== req.auth.id) {
        throw Object.assign(new Error('This attempt does not belong to your account.'), { status: 403 });
      }
      if (attempt.submitted_at) {
        const reviewQuestions = await client.query('SELECT id, sort_order, correct_answer, explanation FROM questions WHERE round_id=$1 AND enabled=TRUE ORDER BY sort_order', [attempt.round_id]);
        const userAnswersResult = await client.query(
          'SELECT a.question_id, q.sort_order, a.selected_option FROM answers a JOIN questions q ON q.id=a.question_id WHERE a.attempt_id=$1',
          [attemptId]
        );
        const userAnswers = {};
        for (const r of userAnswersResult.rows) {
          userAnswers[r.question_id] = r.selected_option;
          if (r.sort_order !== null && r.sort_order !== undefined) {
            userAnswers[r.sort_order] = r.selected_option;
          }
        }
        return {
          alreadySubmitted: true,
          message: 'Response Already Submitted',
          score: attempt.score,
          correctCount: attempt.correct_count,
          incorrectCount: attempt.incorrect_count,
          unansweredCount: attempt.unanswered_count,
          timeTakenSeconds: attempt.time_taken_seconds,
          review: reviewQuestions.rows.map((q) => ({
            id: Number(q.id),
            sort_order: Number(q.sort_order),
            correct_answer: q.correct_answer,
            explanation: q.explanation || null,
          })),
          answers: userAnswers,
        };
      }
      // Strict 45-second network buffer (absorbs Wi-Fi lag, blocks late solving)
      if (new Date(attempt.deadline_at).getTime() + 45 * 1000 < Date.now()) {
        throw Object.assign(new Error('The round deadline has officially concluded.'), { status: 409 });
      }

      const questionsResult = await client.query('SELECT id, sort_order, correct_answer, points_correct, points_wrong, explanation FROM questions WHERE round_id=$1 AND enabled=TRUE ORDER BY sort_order', [attempt.round_id]);
      const questions = questionsResult.rows;
      if (!questions.length) throw Object.assign(new Error('No questions are configured for this round.'), { status: 503 });

      const byDbId = new Map();
      const bySortOrder = new Map();

      for (const a of answers.data) {
        const opt = a.selectedOption !== undefined ? a.selectedOption : a.selected_option;
        const qId = a.questionId ?? a.id;
        const sort = a.sortOrder ?? a.sort_order;

        if (sort !== undefined && sort !== null) {
          bySortOrder.set(Number(sort), opt);
        }
        if (qId !== undefined && qId !== null) {
          byDbId.set(Number(qId), opt);
        }
      }

      const submittedQIds = answers.data.map((a) => Number(a.questionId ?? a.id)).filter((id) => !isNaN(id));
      const dbIds = new Set(questions.map((q) => Number(q.id)));
      const sortOrders = new Set(questions.map((q) => Number(q.sort_order)));

      const hasInvalidDbId = submittedQIds.some((id) => !dbIds.has(id));
      const hasInvalidSortOrder = submittedQIds.some((id) => !sortOrders.has(id));
      const clientSentSortOrder = hasInvalidDbId || (bySortOrder.size > 0 && !hasInvalidSortOrder);

      let correctCount = 0;
      let incorrectCount = 0;
      let unansweredCount = 0;
      let score = 0;

      for (const question of questions) {
        const qDbId = Number(question.id);
        const qSort = Number(question.sort_order);

        let selected;
        if (bySortOrder.size > 0) {
          selected = bySortOrder.get(qSort);
        } else if (clientSentSortOrder) {
          selected = byDbId.get(qSort);
        } else {
          selected = byDbId.get(qDbId);
        }
        if (selected === undefined || selected === null) {
          unansweredCount += 1;
          continue;
        }
        if (selected === question.correct_answer) {
          correctCount += 1;
          score += Number(question.points_correct);
        } else {
          incorrectCount += 1;
          score += Number(question.points_wrong);
        }

        await client.query(
          'INSERT INTO answers(attempt_id, question_id, selected_option) VALUES($1,$2,$3) ON CONFLICT(attempt_id,question_id) DO UPDATE SET selected_option=EXCLUDED.selected_option',
          [attemptId, question.id, selected],
        );
      }

      const submitted = await client.query(
        `UPDATE attempts SET
           submitted_at=NOW(),
           score=$2,
           correct_count=$3,
           incorrect_count=$4,
           unanswered_count=$5,
           time_taken_seconds=LEAST(
             ROUND(EXTRACT(EPOCH FROM (deadline_at - started_at))::numeric, 3),
             GREATEST(0.001, ROUND(EXTRACT(EPOCH FROM (NOW() - started_at))::numeric, 3))
           )
         WHERE id=$1 AND submitted_at IS NULL
         RETURNING score, correct_count, incorrect_count, unanswered_count, time_taken_seconds`,
        [attemptId, score, correctCount, incorrectCount, unansweredCount],
      );
      if (!submitted.rowCount) throw Object.assign(new Error('Submission was already recorded.'), { status: 409 });

      await client.query('INSERT INTO audit_events(actor_type, actor_id, event_type, details) VALUES($1,$2,$3,$4)', [
        'participant',
        attempt.participant_id,
        `round${attempt.round_id}.submitted`,
        JSON.stringify({ participantId: attempt.participant_id, attemptId, score }),
      ]);

      const userAnswersResult = await client.query(
        'SELECT a.question_id, q.sort_order, a.selected_option FROM answers a JOIN questions q ON q.id=a.question_id WHERE a.attempt_id=$1',
        [attemptId]
      );
      const userAnswers = {};
      for (const r of userAnswersResult.rows) {
        userAnswers[r.question_id] = r.selected_option;
        if (r.sort_order !== null && r.sort_order !== undefined) {
          userAnswers[r.sort_order] = r.selected_option;
        }
      }

      return {
        ...submitted.rows[0],
        review: questions.map((q) => ({
          id: Number(q.id),
          sort_order: Number(q.sort_order),
          correct_answer: q.correct_answer,
          explanation: q.explanation || null,
        })),
        answers: userAnswers,
      };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/leaderboard', async (_req, res, next) => {
  try {
    const result = await query(`
      SELECT p.full_name AS name, p.roll_number, p.college_name,
        MAX(a.score) FILTER (WHERE a.round_id=1) AS round1_score,
        MAX(a.score) FILTER (WHERE a.round_id=2) AS round2_score,
        MAX(a.score) FILTER (WHERE a.round_id=3) AS round3_score,
        COALESCE(SUM(a.score) FILTER (WHERE a.submitted_at IS NOT NULL),0) AS total_score,
        COALESCE(SUM(a.time_taken_seconds) FILTER (WHERE a.submitted_at IS NOT NULL),0) AS total_time_seconds
      FROM participants p
      LEFT JOIN attempts a ON a.participant_id=p.id
      GROUP BY p.id
      ORDER BY total_score DESC, total_time_seconds ASC, p.full_name ASC
      LIMIT 500
    `);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.get('/admin/participants', requireAuth('admin'), async (_req, res, next) => {
  try {
    const [result, qualEvents, proctorViolations] = await Promise.all([
      query(`
        SELECT
          p.id,
          p.full_name,
          p.roll_number,
          p.college_name,
          p.ticket_id,
          p.assigned_seat,
          p.department,
          p.year_of_study,
          p.access_code,
          p.approval_status,
          p.created_at,
          COUNT(a.id)::int AS total_attempts,
          MAX(a.round_id)::int AS latest_round_id,
          COALESCE(SUM(a.score) FILTER (WHERE a.submitted_at IS NOT NULL), 0)::int AS total_score,
          COALESCE(SUM(a.correct_count) FILTER (WHERE a.submitted_at IS NOT NULL), 0)::int AS total_correct,
          COALESCE(SUM(a.incorrect_count) FILTER (WHERE a.submitted_at IS NOT NULL), 0)::int AS total_incorrect,
          COALESCE(SUM(a.unanswered_count) FILTER (WHERE a.submitted_at IS NOT NULL), 0)::int AS total_unanswered,
          COALESCE(SUM(a.time_taken_seconds) FILTER (WHERE a.submitted_at IS NOT NULL), 0)::int AS total_time_seconds,
          json_agg(
            json_build_object(
              'id', a.id,
              'roundId', a.round_id,
              'startedAt', a.started_at,
              'deadlineAt', a.deadline_at,
              'submittedAt', a.submitted_at,
              'score', a.score,
              'correctCount', a.correct_count,
              'incorrectCount', a.incorrect_count,
              'unansweredCount', a.unanswered_count,
              'timeTakenSeconds', a.time_taken_seconds
            ) ORDER BY a.round_id ASC
          ) FILTER (WHERE a.id IS NOT NULL) AS attempts
        FROM participants p
        LEFT JOIN attempts a ON a.participant_id = p.id
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `),
      query("SELECT event_type, details FROM audit_events WHERE event_type IN ('qualification.executed', 'round2.qualified', 'round3.qualified')"),
      query("SELECT actor_id, COUNT(*)::int AS count FROM audit_events WHERE event_type IN ('proctor.tab_switch', 'proctor.autosubmit_violation') GROUP BY actor_id"),
    ]);

    const proctorFlagsMap = new Map(proctorViolations.rows.map((r) => [Number(r.actor_id), r.count]));

    const r1QualExecuted = qualEvents.rows.some((e) => e.event_type === 'qualification.executed' && String(e.details?.sourceRound) === '1');
    const r2QualExecuted = qualEvents.rows.some((e) => e.event_type === 'qualification.executed' && String(e.details?.sourceRound) === '2');

    const r2QualifiedSet = new Set(
      qualEvents.rows
        .filter((e) => e.event_type === 'round2.qualified')
        .map((e) => Number(e.details?.participantId))
    );
    const r3QualifiedSet = new Set(
      qualEvents.rows
        .filter((e) => e.event_type === 'round3.qualified')
        .map((e) => Number(e.details?.participantId))
    );

    const participants = result.rows.map((row) => {
      const participantId = Number(row.id);
      const attempts = row.attempts || [];
      const r1Attempt = attempts.find((a) => Number(a.roundId) === 1);
      const r2Attempt = attempts.find((a) => Number(a.roundId) === 2);
      const r3Attempt = attempts.find((a) => Number(a.roundId) === 3);

      // Round 1
      const r1Submitted = Boolean(r1Attempt?.submittedAt);
      const r1Started = Boolean(r1Attempt?.startedAt);
      const r1Status = r1Submitted ? 'COMPLETED' : r1Started ? 'IN_PROGRESS' : 'READY';
      const r1Score = r1Submitted ? Number(r1Attempt.score ?? 0) : null;
      const r1Solved = r1Submitted ? Number(r1Attempt.correctCount ?? 0) : 0;

      // Round 2 Eligibility & Status
      const r2Eligible =
        r1Submitted &&
        r1QualExecuted &&
        r2QualifiedSet.has(participantId);
      const r2Submitted = Boolean(r2Attempt?.submittedAt);
      const r2Started = Boolean(r2Attempt?.startedAt);
      const r2Status = r2Submitted ? 'COMPLETED' : r2Started ? 'IN_PROGRESS' : r2Eligible ? 'ELIGIBLE' : 'LOCKED';
      const r2Score = r2Submitted ? Number(r2Attempt.score ?? 0) : null;
      const r2Solved = r2Submitted ? Number(r2Attempt.correctCount ?? 0) : 0;

      // Round 3 Eligibility & Status
      const r3Eligible =
        r2Submitted &&
        r2QualExecuted &&
        r3QualifiedSet.has(participantId);
      const r3Submitted = Boolean(r3Attempt?.submittedAt);
      const r3Started = Boolean(r3Attempt?.startedAt);
      const r3Status = r3Submitted ? 'COMPLETED' : r3Started ? 'IN_PROGRESS' : r3Eligible ? 'ELIGIBLE' : 'LOCKED';
      const r3Score = r3Submitted ? Number(r3Attempt.score ?? 0) : null;
      const r3Solved = r3Submitted ? Number(r3Attempt.correctCount ?? 0) : 0;

      const participatingRounds = ['R-01'];
      if (r2Submitted || r2Started || r2Eligible) participatingRounds.push('R-02');
      if (r3Submitted || r3Started || r3Eligible) participatingRounds.push('R-03');

      // Latest attempt & overall status
      let statusType = 'in-progress';
      let statusLabel = 'REGISTERED';
      let activeRoundTag = 'R-01';

      if (r3Submitted) {
        statusType = 'completed';
        statusLabel = 'COMPLETED (R-03)';
        activeRoundTag = 'R-03';
      } else if (r3Started) {
        statusType = 'in-progress';
        statusLabel = 'IN-PROGRESS (R-03)';
        activeRoundTag = 'R-03';
      } else if (r2Submitted) {
        statusType = 'completed';
        statusLabel = 'COMPLETED (R-02)';
        activeRoundTag = 'R-02';
      } else if (r2Started) {
        statusType = 'in-progress';
        statusLabel = 'IN-PROGRESS (R-02)';
        activeRoundTag = 'R-02';
      } else if (r1Submitted) {
        statusType = 'completed';
        statusLabel = 'COMPLETED (R-01)';
        activeRoundTag = 'R-01';
      } else if (r1Started) {
        statusType = 'in-progress';
        statusLabel = 'IN-PROGRESS (R-01)';
        activeRoundTag = 'R-01';
      }

      const violationCount = proctorFlagsMap.get(participantId) || 0;
      if (violationCount >= 3 && !r3Submitted) {
        statusType = 'flagged-focus';
        statusLabel = 'AUTO-SUBMITTED (3 VIOLATIONS)';
      } else if (violationCount > 0 && !r3Submitted) {
        statusType = 'flagged-focus';
        statusLabel = `FLAGGED: TAB BLUR (${violationCount}x)`;
      }

      const latestAttempt = r3Attempt || r2Attempt || r1Attempt || null;

      const solvedCount = latestAttempt ? (latestAttempt.correctCount || 0) : 0;
      const totalAttempted = latestAttempt ? ((latestAttempt.correctCount || 0) + (latestAttempt.incorrectCount || 0)) : 0;
      const accuracy = totalAttempted > 0 ? Math.round(((latestAttempt.correctCount || 0) / totalAttempted) * 100) : 0;

      const initials = (row.full_name || '')
        .split(' ')
        .filter(Boolean)
        .map((w) => w[0].toUpperCase())
        .slice(0, 2)
        .join('') || 'P';

      return {
        id: String(row.id),
        initials,
        name: row.full_name,
        campus: row.college_name || 'Department of Computer Science',
        department: row.department || 'CSE',
        yearOfStudy: row.year_of_study || '1st Year',
        accessCode: row.access_code || '—',
        approvalStatus: row.approval_status || 'PENDING',
        rollNumber: row.roll_number,
        node: row.assigned_seat || `Station #${((Number(row.id) - 1) % 120) + 1}`,
        ticketId: row.ticket_id || `DM-26-${String(row.id).padStart(4, '0')}`,
        round: participatingRounds.map((r) => {
          if (r === 'R-01') return `R-01 // ${r1Status}`;
          if (r === 'R-02') return `R-02 // ${r2Status}`;
          return `R-03 // ${r3Status}`;
        }).join(' | '),
        statusType,
        statusLabel,
        solvedCount,
        totalQuestions: activeRoundTag === 'R-01' ? 50 : activeRoundTag === 'R-02' ? 30 : 30,
        accuracy,
        score: latestAttempt?.score ?? row.total_score,
        totalScore: row.total_score,
        registeredAt: row.created_at,
        participatingRounds,
        attempts,
        rounds: {
          1: {
            roundId: 1,
            status: r1Status,
            submitted: r1Submitted,
            started: r1Started,
            score: r1Score,
            solvedCount: r1Solved,
            totalQuestions: 50,
            timeTakenSeconds: r1Attempt?.timeTakenSeconds || 0,
            submittedAt: r1Attempt?.submittedAt || null,
          },
          2: {
            roundId: 2,
            status: r2Status,
            submitted: r2Submitted,
            started: r2Started,
            eligible: r2Eligible,
            score: r2Score,
            solvedCount: r2Solved,
            totalQuestions: 30,
            timeTakenSeconds: r2Attempt?.timeTakenSeconds || 0,
            submittedAt: r2Attempt?.submittedAt || null,
          },
          3: {
            roundId: 3,
            status: r3Status,
            submitted: r3Submitted,
            started: r3Started,
            eligible: r3Eligible,
            score: r3Score,
            solvedCount: r3Solved,
            totalQuestions: 30,
            timeTakenSeconds: r3Attempt?.timeTakenSeconds || 0,
            submittedAt: r3Attempt?.submittedAt || null,
          },
        },
        activeItem: latestAttempt?.submittedAt ? 'SUBMISSION_VERIFIED' : 'ACTIVE_PROCTOR',
        itemDwellSec: latestAttempt?.timeTakenSeconds || 0,
      };
    });

    res.json(participants);
  } catch (error) {
    next(error);
  }
});

// Admin Approval Actions
router.post('/admin/participants/:id/approve', requireAuth('admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const updated = await query(
      "UPDATE participants SET approval_status = 'APPROVED' WHERE id = $1 RETURNING id, full_name, roll_number, access_code, approval_status",
      [id],
    );
    if (!updated.rowCount) return res.status(404).json({ error: 'Participant not found.' });
    await query('INSERT INTO audit_events(actor_type, actor_id, event_type, details) VALUES ($1,$2,$3,$4)', [
      'admin',
      req.auth.id,
      'participant.approved',
      JSON.stringify({ participantId: id, accessCode: updated.rows[0].access_code }),
    ]);
    res.json({ success: true, participant: updated.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.post('/admin/participants/:id/reject', requireAuth('admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const updated = await query(
      "UPDATE participants SET approval_status = 'REJECTED' WHERE id = $1 RETURNING id, full_name, roll_number, approval_status",
      [id],
    );
    if (!updated.rowCount) return res.status(404).json({ error: 'Participant not found.' });
    res.json({ success: true, participant: updated.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.post('/admin/participants/approve-all', requireAuth('admin'), async (req, res, next) => {
  try {
    const result = await query(
      "UPDATE participants SET approval_status = 'APPROVED' WHERE approval_status = 'PENDING' RETURNING id, full_name, roll_number, access_code",
    );
    await query('INSERT INTO audit_events(actor_type, actor_id, event_type, details) VALUES ($1,$2,$3,$4)', [
      'admin',
      req.auth.id,
      'participants.approve_all',
      JSON.stringify({ count: result.rowCount }),
    ]);
    res.json({ success: true, approvedCount: result.rowCount });
  } catch (error) {
    next(error);
  }
});

// Admin Broadcast Notice
router.post('/admin/broadcast', requireAuth('admin'), async (req, res, next) => {
  try {
    const body = z.object({
      message: z.string().trim().min(1).max(500),
    }).safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: 'Broadcast message is required (max 500 characters).' });
    }
    const msg = body.data.message;
    await query(
      'UPDATE competition_state SET broadcast_message = $1, broadcast_timestamp = NOW() WHERE singleton = TRUE',
      [msg],
    );
    await query('INSERT INTO audit_events(actor_type, actor_id, event_type, details) VALUES ($1,$2,$3,$4)', [
      'admin',
      req.auth.id,
      'competition.broadcast',
      JSON.stringify({ message: msg }),
    ]);
    res.json({ success: true, broadcastMessage: msg, broadcastTimestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

router.delete('/admin/broadcast', requireAuth('admin'), async (_req, res, next) => {
  try {
    await query(
      'UPDATE competition_state SET broadcast_message = NULL, broadcast_timestamp = NULL WHERE singleton = TRUE',
    );
    res.json({ success: true, message: 'Broadcast cleared.' });
  } catch (error) {
    next(error);
  }
});

router.patch('/admin/competition/state', requireAuth('admin'), async (req, res, next) => {
  try {
    const parsed = z.object({
      status: z.enum(['NOT_STARTED', 'LIVE', 'PAUSED', 'COMPLETED']).optional(),
      activeRound: z.number().int().min(1).max(3).nullable().optional(),
      registrationOpen: z.boolean().optional(),
      roundStates: z.record(z.string(), z.enum(['active', 'locked', 'completed'])).optional(),
      roundDurations: z.record(z.string(), z.number().int().min(60).max(7200)).optional(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid competition settings.' });
    const { status, activeRound, registrationOpen, roundStates, roundDurations } = parsed.data;
    const result = await query(
      `UPDATE competition_state SET
         status=COALESCE($1,status),
         active_round=CASE WHEN $2::boolean THEN $3 ELSE active_round END,
         registration_open=COALESCE($4,registration_open),
         round_states=CASE WHEN $5::jsonb IS NOT NULL THEN COALESCE(round_states, '{"1":"active","2":"locked","3":"locked"}'::jsonb) || $5::jsonb ELSE round_states END,
         round_durations=CASE WHEN $6::jsonb IS NOT NULL THEN COALESCE(round_durations, '{"1":600,"2":600,"3":180}'::jsonb) || $6::jsonb ELSE round_durations END,
         updated_at=NOW()
       WHERE singleton=TRUE RETURNING *`,
      [status ?? null, activeRound !== undefined, activeRound ?? null, registrationOpen ?? null, roundStates ? JSON.stringify(roundStates) : null, roundDurations ? JSON.stringify(roundDurations) : null],
    );
    await query('INSERT INTO audit_events(actor_type, actor_id, event_type, details) VALUES($1,$2,$3,$4)', ['admin', req.auth.id, 'competition.state.updated', JSON.stringify(parsed.data)]);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.post('/admin/qualify/:roundId', requireAuth('admin'), async (req, res, next) => {
  try {
    const roundId = Number(req.params.roundId);
    if (![1, 2].includes(roundId)) return res.status(400).json({ error: 'Only Round 1 and Round 2 determine qualification.' });
    const limit = Number(req.body?.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) return res.status(400).json({ error: 'Qualification limit must be between 1 and 200.' });
    const result = await query(
      `SELECT a.participant_id, a.score, a.time_taken_seconds,
              COALESCE(a.time_taken_seconds, ROUND(EXTRACT(EPOCH FROM (a.submitted_at - a.started_at))::numeric, 3)) AS completion_time
       FROM attempts a
       WHERE a.round_id=$1 AND a.submitted_at IS NOT NULL
       ORDER BY a.score DESC,
                COALESCE(a.time_taken_seconds, ROUND(EXTRACT(EPOCH FROM (a.submitted_at - a.started_at))::numeric, 3)) ASC,
                a.participant_id ASC
       LIMIT $2`,
      [roundId, limit],
    );
    const eventType = `round${roundId + 1}.qualified`;
    await withTransaction(async (client) => {
      // Re-running qualification replaces the previous list instead of adding to it.
      await client.query('DELETE FROM audit_events WHERE event_type=$1', [eventType]);
      for (const row of result.rows) {
        await client.query('INSERT INTO audit_events(actor_type,actor_id,event_type,details) VALUES($1,$2,$3,$4)', [
          'system',
          row.participant_id,
          eventType,
          JSON.stringify({
            participantId: row.participant_id,
            sourceRound: roundId,
            score: row.score,
            timeTakenSeconds: Number(row.completion_time ?? row.time_taken_seconds ?? 0),
          }),
        ]);
      }
      await client.query('INSERT INTO audit_events(actor_type,actor_id,event_type,details) VALUES($1,$2,$3,$4)', [
        'admin',
        req.auth.id,
        'qualification.executed',
        JSON.stringify({ sourceRound: roundId, qualifiedCount: result.rowCount, limit }),
      ]);
    });
    res.json({ sourceRound: roundId, nextRound: roundId + 1, qualifiedCount: result.rowCount, qualifiedParticipantIds: result.rows.map((row) => Number(row.participant_id)) });
  } catch (error) {
    next(error);
  }
});

router.post('/admin/qualifications/reset', requireAuth('admin'), async (req, res, next) => {
  try {
    await query("DELETE FROM audit_events WHERE event_type IN ('qualification.executed', 'round2.qualified', 'round3.qualified')");
    await query('INSERT INTO audit_events(actor_type, actor_id, event_type, details) VALUES($1,$2,$3,$4)', [
      'admin',
      req.auth.id,
      'qualifications.reset',
      JSON.stringify({ timestamp: new Date().toISOString() }),
    ]);
    res.json({ success: true, message: 'All qualification records have been reset.' });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/attempts', requireAuth('admin'), async (_req, res, next) => {
  try {
    const result = await query(`
      SELECT p.full_name, p.roll_number, a.round_id, a.score, a.correct_count, a.incorrect_count, a.unanswered_count, a.started_at, a.deadline_at, a.submitted_at
      FROM attempts a
      JOIN participants p ON p.id=a.participant_id
      ORDER BY a.round_id, a.score DESC NULLS LAST, a.time_taken_seconds ASC NULLS LAST
    `);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.get('/admin/overview-stats', requireAuth('admin'), async (_req, res, next) => {
  try {
    const [counts, r1Comp, r2Comp, r3Comp, qualEvents, scores, auditLogs] = await Promise.all([
      query(`
        SELECT
          (SELECT COUNT(*)::int FROM participants) AS total_participants,
          (SELECT COUNT(*)::int FROM attempts WHERE submitted_at IS NULL AND deadline_at > NOW()) AS active_attempts,
          (SELECT COUNT(*)::int FROM attempts WHERE submitted_at IS NOT NULL) AS completed_attempts
      `),
      query('SELECT COUNT(*)::int AS count FROM attempts WHERE round_id=1 AND submitted_at IS NOT NULL'),
      query('SELECT COUNT(*)::int AS count FROM attempts WHERE round_id=2 AND submitted_at IS NOT NULL'),
      query('SELECT COUNT(*)::int AS count FROM attempts WHERE round_id=3 AND submitted_at IS NOT NULL'),
      query("SELECT event_type, details FROM audit_events WHERE event_type IN ('round2.qualified', 'round3.qualified')"),
      query(`
        SELECT
          COALESCE(ROUND(AVG(score)::numeric, 2), 0)::float AS avg_score,
          COALESCE(MAX(score), 0)::int AS top_score
        FROM attempts
        WHERE submitted_at IS NOT NULL
      `),
      query(`
        SELECT ae.id, ae.created_at, ae.event_type, ae.details, p.full_name, p.assigned_seat
        FROM audit_events ae
        LEFT JOIN participants p ON p.id = ae.actor_id AND ae.actor_type = 'participant'
        ORDER BY ae.created_at DESC
        LIMIT 20
      `),
    ]);

    const c = counts.rows[0];
    const r2QualCount = qualEvents.rows.filter((e) => e.event_type === 'round2.qualified').length;
    const r3QualCount = qualEvents.rows.filter((e) => e.event_type === 'round3.qualified').length;

    const formattedLogs = auditLogs.rows.map((row) => {
      const time = new Date(row.created_at).toLocaleTimeString('en-US', { hour12: false });
      const node = row.assigned_seat || 'ADMIN-CORE';
      let message = row.event_type;
      if (row.event_type === 'participant.registered') {
        message = `${row.full_name || 'Candidate'} registered at station`;
      } else if (row.event_type.endsWith('.submitted')) {
        message = `${row.full_name || 'Candidate'} submitted Round ${row.event_type[5]} attempt (Score: ${row.details?.score ?? 0} pts)`;
      } else if (row.event_type === 'qualification.executed') {
        message = `Qualification executed for Round ${row.details?.sourceRound}: ${row.details?.qualifiedCount} candidates promoted`;
      } else if (row.event_type === 'competition.state.updated') {
        message = `Tournament state updated by admin`;
      } else if (row.event_type === 'round.reset') {
        message = `Round ${row.details?.roundId} reset by administrator`;
      } else if (row.event_type === 'proctor.tab_switch') {
        message = `âš ï¸ PROCTOR ALERT: ${row.full_name || 'Candidate'} switched tabs or lost focus (Warning #${row.details?.warningCount ?? 1})`;
      } else if (row.event_type === 'proctor.autosubmit_violation') {
        message = `ðŸš¨ PROCTOR DISQUALIFICATION: ${row.full_name || 'Candidate'} automatically submitted on 3rd violation!`;
      }

      return {
        id: String(row.id),
        time,
        node,
        message,
      };
    });

    res.json({
      totalParticipants: c.total_participants,
      activeAttempts: c.active_attempts,
      completedAttempts: c.completed_attempts,
      r1Completed: r1Comp.rows[0].count,
      r2Completed: r2Comp.rows[0].count,
      r3Completed: r3Comp.rows[0].count,
      r1Total: c.total_participants,
      r2Qualified: r2QualCount,
      r3Qualified: r3QualCount,
      avgScore: scores.rows[0].avg_score,
      topScore: scores.rows[0].top_score,
      recentLogs: formattedLogs,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/admin/rounds/:roundId/reset', requireAuth('admin'), async (req, res, next) => {
  try {
    const roundId = Number(req.params.roundId);
    if (![1, 2, 3].includes(roundId)) return res.status(400).json({ error: 'Invalid round ID.' });

    await withTransaction(async (client) => {
      const deletedAttempts = await client.query('DELETE FROM attempts WHERE round_id = $1 RETURNING id', [roundId]);
      const eventType = `round${roundId + 1}.qualified`;
      await client.query('DELETE FROM audit_events WHERE event_type=$1', [eventType]);
      await client.query("DELETE FROM audit_events WHERE event_type='qualification.executed' AND details->>'sourceRound'=$1", [String(roundId)]);
      await client.query('INSERT INTO audit_events(actor_type, actor_id, event_type, details) VALUES($1, $2, $3, $4)', [
        'admin',
        req.auth.id,
        'round.reset',
        JSON.stringify({ roundId, deletedAttemptsCount: deletedAttempts.rowCount }),
      ]);
    });

    res.json({ message: `Round ${roundId} successfully reset.`, roundId });
  } catch (error) {
    next(error);
  }
});

router.post('/admin/reset-attempts', requireAuth('admin'), async (req, res, next) => {
  try {
    let deletedCount = 0;
    await withTransaction(async (client) => {
      await client.query('DELETE FROM answers');
      const deleted = await client.query('DELETE FROM attempts RETURNING id');
      deletedCount = deleted.rowCount || 0;
      await client.query("DELETE FROM audit_events WHERE event_type LIKE 'round%' OR event_type LIKE 'qualification%' OR event_type LIKE 'proctor%'");
      await client.query('INSERT INTO audit_events(actor_type, actor_id, event_type, details) VALUES($1, $2, $3, $4)', [
        'admin',
        req.auth.id,
        'attempts.reset_all',
        JSON.stringify({ timestamp: new Date().toISOString(), deletedAttempts: deletedCount }),
      ]);
    });
    res.json({ success: true, message: `All attempts (${deletedCount}) have been reset. Registered participants are retained.`, deletedAttempts: deletedCount });
  } catch (error) {
    next(error);
  }
});

router.post('/admin/reset-all', requireAuth('admin'), async (req, res, next) => {
  try {
    await withTransaction(async (client) => {
      await client.query('DELETE FROM answers');
      await client.query('DELETE FROM attempts');
      await client.query('DELETE FROM participants');
      await client.query("DELETE FROM audit_events WHERE actor_type = 'participant' OR event_type LIKE 'round%' OR event_type LIKE 'qualification%' OR event_type LIKE 'proctor%'");
      await client.query(`
        UPDATE competition_state SET
          status = 'NOT_STARTED',
          active_round = NULL,
          round_states = '{"1":"locked","2":"locked","3":"locked"}'::jsonb,
          updated_at = NOW()
        WHERE singleton = TRUE
      `);
      await client.query('INSERT INTO audit_events(actor_type, actor_id, event_type, details) VALUES($1, $2, $3, $4)', [
        'admin',
        req.auth.id,
        'competition.full_reset',
        JSON.stringify({ timestamp: new Date().toISOString() }),
      ]);
    });
    res.json({ success: true, message: 'All participant registrations, round attempts, and audit logs have been completely reset.' });
  } catch (error) {
    next(error);
  }
});

