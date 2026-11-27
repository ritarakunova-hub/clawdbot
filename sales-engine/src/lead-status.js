const STATUS_READY = 'Готов к проверке';
const STATUS_APPROVED = 'Одобрено к отправке';
const STATUS_SENT = 'Отправлено';

function getLeadActionTransition(action, currentStatus) {
  if (currentStatus === STATUS_READY) {
    if (action === 'approve') {
      return { nextStatus: STATUS_APPROVED, callbackText: 'Одобрено к отправке' };
    }
    if (action === 'reject') {
      return { nextStatus: 'Отклонён', callbackText: 'Отклонён' };
    }
    if (action === 'edit') {
      return { nextStatus: 'Нужна правка', callbackText: 'Нужна правка' };
    }
  }

  if (action === 'sent' && currentStatus === STATUS_APPROVED) {
    return { nextStatus: STATUS_SENT, callbackText: 'Отправлено — follow-up отсчёт начат' };
  }

  return null;
}

module.exports = {
  STATUS_READY,
  STATUS_APPROVED,
  STATUS_SENT,
  getLeadActionTransition,
};
