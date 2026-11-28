const REVIEWABLE_STATES = new Set(['creating_draft', 'handoff_dispatching', 'topic_reminder_dispatching']);

function requireRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record) ||
      typeof record.postId !== 'string' || !record.postId) {
    throw new TypeError('A valid pending operation record is required');
  }
}

function requireMessageId(messageId, fieldName) {
  if (!Number.isSafeInteger(messageId) || messageId <= 0) {
    throw new TypeError(fieldName + ' must be a positive safe integer');
  }
}

function beginHandoff(record, at) {
  requireRecord(record);
  if (record.status !== 'pending') {
    throw new Error('Only a pending draft can begin SMMplanner handoff');
  }
  requireMessageId(record.telegramMessageId, 'telegramMessageId');

  return {
    ...record,
    status: 'handoff_dispatching',
    handoffStartedAt: at,
  };
}

function completeHandoff(record, handoffMessageId, at) {
  requireRecord(record);
  if (record.status !== 'handoff_dispatching') {
    throw new Error('Only a dispatching handoff can be completed');
  }
  requireMessageId(handoffMessageId, 'handoffMessageId');

  return {
    ...record,
    status: 'approved_for_smmplanner',
    approvedAt: at,
    handoffMessageId,
  };
}

function completeDraftDelivery(record, telegramMessageId) {
  requireRecord(record);
  if (record.status !== 'creating_draft') {
    throw new Error('Only a creating_draft operation can become pending');
  }
  requireMessageId(telegramMessageId, 'telegramMessageId');

  return {
    ...record,
    telegramMessageId,
    status: 'pending',
  };
}

function beginTopicReminder(record, at) {
  requireRecord(record);
  if (record.status !== 'topic_reminder_pending') {
    throw new Error('Only a topic_reminder_pending operation can begin delivery');
  }
  return {
    ...record,
    status: 'topic_reminder_dispatching',
    reminderStartedAt: at,
  };
}

function completeTopicReminder(record, telegramMessageId, at) {
  requireRecord(record);
  if (record.status !== 'topic_reminder_dispatching') {
    throw new Error('Only a dispatching topic reminder can be completed');
  }
  requireMessageId(telegramMessageId, 'telegramMessageId');
  return {
    ...record,
    status: 'topic_reminder',
    notifiedAt: at,
    telegramMessageId,
  };
}

function markNeedsReview(record, { stage, code, at }) {
  requireRecord(record);
  if (!REVIEWABLE_STATES.has(record.status) &&
      !(record.status === 'pending' && !record.telegramMessageId)) {
    throw new Error('This operation state cannot be moved to needs_review');
  }
  if (!stage || !code || !at) {
    throw new TypeError('Manual review stage, code and timestamp are required');
  }

  return {
    ...record,
    status: 'needs_review',
    needsReviewAt: at,
    lastErrorStage: stage,
    lastErrorCode: code,
  };
}

function recoverInterruptedOperation(record, at) {
  requireRecord(record);
  const interrupted =
    REVIEWABLE_STATES.has(record.status) ||
    (record.status === 'pending' && !record.telegramMessageId);

  if (!interrupted) return { interrupted: false, record };

  const stage = record.status === 'handoff_dispatching'
    ? 'smmplanner_handoff'
    : record.status === 'topic_reminder_dispatching'
      ? 'topic_reminder'
      : 'draft_delivery';

  return {
    interrupted: true,
    record: markNeedsReview(record, {
      stage,
      code: 'PROCESS_RESTART_DURING_EXTERNAL_OPERATION',
      at,
    }),
  };
}

module.exports = {
  beginHandoff,
  completeHandoff,
  completeDraftDelivery,
  beginTopicReminder,
  completeTopicReminder,
  markNeedsReview,
  recoverInterruptedOperation,
};
