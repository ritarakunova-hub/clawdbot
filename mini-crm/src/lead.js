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

  // Некоторые формы дают одно общее поле "Контакт" (телефон/почта/Telegram
  // одной строкой), а не раздельные email/phone. Если раздельных полей
  // не нашлось — раскладываем "Контакт" по простому признаку (есть "@" —
  // это похоже на почту, иначе кладём в телефон, там же обычно и Telegram).
  const generalContact = pick(data, ['contact', 'Contact', 'контакт', 'Контакт']);
  if (generalContact && !lead.email && !lead.phone) {
    if (generalContact.includes('@')) {
      lead.email = generalContact;
    } else {
      lead.phone = generalContact;
    }
  }

  const now = new Date().toISOString();
  lead.received_at = now;
  lead.last_status_update = now;
  lead.status = 'Новая';
  lead.notes = '';

  return lead;
}

module.exports = { parseNetlifyLead };
