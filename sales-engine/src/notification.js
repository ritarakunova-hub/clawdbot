const STATUS_READY = 'Готов к проверке';
const STATUS_DISPATCHING = 'Уведомление готовится';
const STATUS_NEEDS_REVIEW = 'Уведомление требует проверки';

/**
 * Telegram delivery is deliberately two-phase:
 * 1) send a card without buttons;
 * 2) persist its exact message_id and ready status;
 * 3) only then attach approval buttons.
 *
 * Ambiguous network/storage outcomes fail closed. No automatic resend is
 * attempted because Telegram may already have accepted the first request.
 */
function canRetryLeadNotification(lead) {
  if (!lead || typeof lead !== 'object') return false;
  if ([STATUS_NEEDS_REVIEW, STATUS_DISPATCHING].includes(lead.status)) return true;
  return lead.status === STATUS_READY && !String(lead.telegram_message_id || '').trim();
}

async function deliverLeadCard(lead, { sheets, telegram }) {
  if (!lead || !lead.id || !sheets || !telegram) {
    throw new TypeError('notification_dependencies_missing');
  }

  const markNeedsReview = async () => {
    try {
      await sheets.updateFields(lead.id, { status: STATUS_NEEDS_REVIEW });
    } catch {
      // Preserve fail-closed behavior even when the store is unavailable.
    }
  };

  let staged = false;
  try {
    staged = await sheets.updateFields(lead.id, {
      status: STATUS_DISPATCHING,
      telegram_message_id: '',
    });
  } catch {
    await markNeedsReview();
    return { ok: false, stage: 'stage' };
  }
  if (!staged) {
    await markNeedsReview();
    return { ok: false, stage: 'stage' };
  }

  let stage = 'send';
  try {
    const rawMessageId = await telegram.sendLeadCard(lead);
    const messageId = Number(rawMessageId);
    if (!Number.isSafeInteger(messageId) || messageId <= 0) {
      throw new Error('telegram_message_id_missing');
    }

    stage = 'persist';
    const persisted = await sheets.updateFields(lead.id, {
      telegram_message_id: String(messageId),
      status: STATUS_READY,
    });
    if (!persisted) throw new Error('telegram_message_id_not_persisted');

    stage = 'keyboard';
    await telegram.attachLeadKeyboard(messageId, lead.id);
    return { ok: true, messageId };
  } catch {
    await markNeedsReview();
    return { ok: false, stage };
  }
}

module.exports = {
  STATUS_READY,
  STATUS_DISPATCHING,
  STATUS_NEEDS_REVIEW,
  canRetryLeadNotification,
  deliverLeadCard,
};
