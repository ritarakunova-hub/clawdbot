const PROCESSED_STATES = new Set(['published', 'cancelled']);

function getPendingDecision(existing, today) {
  if (!existing) return 'create';

  if (existing.postId === today) {
    return PROCESSED_STATES.has(existing.status) ? 'already_processed' : 'keep_pending';
  }

  // A previous day's unfinished draft must not disappear or be replaced silently.
  if (!PROCESSED_STATES.has(existing.status)) return 'keep_pending';

  // A completed/cancelled marker from an earlier day can be replaced by today's draft.
  if (existing.postId < today) return 'clear_and_create';

  // Future-dated state is unexpected; fail closed instead of overwriting it.
  return 'keep_pending';
}

module.exports = { getPendingDecision };
