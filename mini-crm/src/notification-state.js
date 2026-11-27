const NOTIFICATION_STATUS = Object.freeze({
  PENDING: 'pending',
  SENDING: 'sending',
  SENT: 'sent',
  FAILED: 'failed',
});

function decideDuplicateNotification(status) {
  if (status === NOTIFICATION_STATUS.SENT) {
    return { action: 'already_sent' };
  }

  // Only a known pending state proves no Telegram dispatch was started.
  // "sending", "failed" and unknown values fail closed for manual review.
  if (status === NOTIFICATION_STATUS.PENDING) {
    return { action: 'process_pending' };
  }

  return { action: 'manual_review' };
}

module.exports = { NOTIFICATION_STATUS, decideDuplicateNotification };
