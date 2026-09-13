/**
 * Достаёт данные заявки из payload, который присылает Netlify Forms
 * через Outgoing Webhook. Формат Netlify:
 * { form_name, data: { <поля формы> }, ... }
 *
 * Названия полей формы могут отличаться регистром/языком —
 * поэтому проверяем несколько вариантов написания.
 */
function pick(data, names) {
  for (const name of names) {
    if (data[name] !== undefined && data[name] !== '') {
      return String(data[name]);
    }
  }
  return '';
}

function parseNetlifyLead(body) {
  const data = (body && body.data) || {};

  const lead = {
    name: pick(data, ['name', 'Name', 'имя', 'Имя']),
    email: pick(data, ['email', 'Email', 'почта', 'Почта']),
    phone: pick(data, ['phone', 'Phone', 'телефон', 'Телефон']),
    message: pick(data, ['message', 'Message', 'сообщение', 'Сообщение', 'комментарий']),
    form_name: (body && body.form_name) || '',
  };

  const now = new Date().toISOString();
  lead.received_at = now;
  lead.last_status_update = now;
  lead.status = 'Новая';
  lead.notes = '';

  return lead;
}

module.exports = { parseNetlifyLead };
