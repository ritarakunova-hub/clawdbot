const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX = {
  name: 120,
  email: 254,
  phone: 48,
  message: 2000,
  form_name: 120,
  submission_id: 128
};

function pick(data, names) {
  for (const name of names) {
    const value = data[name];
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) return value.map(String).join(', ').trim();
      return String(value).trim();
    }
  }
  return '';
}

function validationError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function assertMaxLength(field, value) {
  if (value.length > MAX[field]) {
    throw validationError('field_too_long', 'Поле ' + field + ' превышает допустимую длину');
  }
}

function hasConsent(data) {
  const value = pick(data, [
    'consent',
    'personal_data_consent',
    'consent_to_processing',
    'data_processing_consent',
    'Согласие на обработку персональных данных',
    'согласие'
  ]).toLowerCase();

  return ['1', 'true', 'yes', 'on', 'accepted', 'согласен', 'согласна', 'да'].includes(value);
}

function parseNetlifyLead(body) {
  const root = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const payload = root.payload && typeof root.payload === 'object' && !Array.isArray(root.payload)
    ? root.payload
    : root;
  const data = payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
    ? payload.data
    : {};

  const submissionId = String(
    payload.id || payload.submission_id || root.id || ''
  ).trim();

  if (!submissionId) {
    throw validationError('missing_submission_id', 'В webhook отсутствует стабильный ID отправки Netlify');
  }
  assertMaxLength('submission_id', submissionId);

  if (!hasConsent(data)) {
    throw validationError('consent_required', 'Нет подтверждённого согласия на обработку данных');
  }

  const lead = {
    submission_id: submissionId,
    name: pick(data, ['name', 'Name', 'имя', 'Имя']),
    email: pick(data, ['email', 'Email', 'почта', 'Почта']),
    phone: pick(data, ['phone', 'Phone', 'телефон', 'Телефон']),
    message: pick(data, ['message', 'Message', 'сообщение', 'Сообщение', 'комментарий']),
    form_name: String(payload.form_name || root.form_name || '').trim(),
    consent_status: 'yes',
    received_at: payload.created_at || root.created_at || new Date().toISOString(),
    status: 'Новая',
    last_status_update: new Date().toISOString(),
    notes: ''
  };

  const generalContact = pick(data, ['contact', 'Contact', 'контакт', 'Контакт']);
  if (generalContact && !lead.email && !lead.phone) {
    if (generalContact.includes('@')) lead.email = generalContact;
    else lead.phone = generalContact;
  }

  for (const field of ['name', 'email', 'phone', 'message', 'form_name']) {
    assertMaxLength(field, lead[field]);
  }

  if (lead.email && !EMAIL_PATTERN.test(lead.email)) {
    throw validationError('invalid_email', 'Указан некорректный email');
  }

  if (lead.phone && lead.phone.replace(/\D/g, '').length < 7) {
    throw validationError('invalid_phone', 'Указан некорректный телефон или контакт');
  }

  if (!lead.email && !lead.phone) {
    throw validationError('contact_required', 'Нужно указать email или телефон/мессенджер');
  }

  const createdAt = new Date(lead.received_at);
  if (Number.isNaN(createdAt.getTime())) {
    throw validationError('invalid_created_at', 'Дата отправки Netlify имеет неверный формат');
  }
  lead.received_at = createdAt.toISOString();

  return lead;
}

module.exports = { parseNetlifyLead, hasConsent };
