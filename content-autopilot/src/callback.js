/**
 * Acknowledge an owner's Telegram button press before starting slow network work.
 * Telegram clients otherwise keep showing a spinner until answerCallbackQuery
 * is called, which must not wait for SMMplanner handoff or owner notification to finish.
 */
function startApprovedAction(callbackId, action, {
  answerCallbackQuery,
  onActionError = async () => {},
  logger = console,
}) {
  let acknowledgement;
  try {
    acknowledgement = answerCallbackQuery(callbackId, 'Команда принята. Выполняю…');
  } catch (err) {
    logger.error('[content-autopilot] Could not acknowledge Telegram callback:', err.message);
  }

  // A failed callback acknowledgement must not prevent the requested action.
  Promise.resolve(acknowledgement).catch((err) => {
    logger.error('[content-autopilot] Could not acknowledge Telegram callback:', err.message);
  });

  // Start the potentially slow action independently of the acknowledgement.
  Promise.resolve()
    .then(action)
    .catch(async (err) => {
      logger.error('[content-autopilot] Telegram decision failed:', err.message);
      try {
        await onActionError(err);
      } catch (notificationError) {
        logger.error('[content-autopilot] Could not notify the owner about the failed decision:', notificationError.message);
      }
    });
}

module.exports = { startApprovedAction };
