# TAINA mini-CRM — Этап 1: приём заявки

Код полностью написан и протестирован. От вас нужны только шаги ниже —
это вещи, которые физически может сделать только владелец аккаунтов
(Google, Amvera), их нельзя автоматизировать за вас.

## Что делает сервис

Принимает POST-запрос от Netlify Forms → разбирает заявку (имя, email,
телефон, сообщение) → дописывает строку в Google-таблицу «Заявки».

## Шаг 1. Создать Google-таблицу

Создайте Google Sheet, назовите лист `Заявки`. Первая строка — заголовки
(любые, сервис их не трогает, просто для вашего удобства):

```
name | email | phone | message | form_name | received_at | status | last_status_update | notes
```

Скопируйте **ID таблицы** — это кусок URL между `/d/` и `/edit`:
`https://docs.google.com/spreadsheets/d/ЭТОТ_КУСОК/edit`

## Шаг 2. Дать сервису доступ к таблице (сервисный аккаунт Google)

1. Откройте [Google Cloud Console](https://console.cloud.google.com/) →
   создайте проект (или выберите существующий).
2. В поиске введите «Google Sheets API» → нажмите **Enable**.
3. Слева: **APIs & Services → Credentials → Create Credentials → Service Account**.
   Имя — любое, например `taina-crm`.
4. Откройте созданный сервисный аккаунт → вкладка **Keys** →
   **Add Key → Create new key → JSON**. Скачается файл `xxx.json`.
5. **Не открывайте этот файл никому и не присылайте мне.** Он даёт доступ
   к таблице.
6. Откройте скачанный JSON, найдите поле `client_email` — это будет
   что-то вроде `taina-crm@ваш-проект.iam.gserviceaccount.com`.
7. Откройте вашу Google-таблицу → **Настройки доступа** → добавьте этот
   email как **Редактора**.
8. Закодируйте содержимое JSON-файла в base64 (это нужно, чтобы вставить
   его одной строкой в Amvera). В терминале (Mac/Linux):
   ```
   base64 -i xxx.json | tr -d '\n'
   ```
   На Windows (PowerShell):
   ```
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("xxx.json"))
   ```
   Получится длинная строка — она и есть значение переменной
   `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64`.

## Шаг 3. Задеплоить на Amvera

1. В личном кабинете Amvera создайте новое приложение, подключите к нему
   этот Git-репозиторий (папку `mini-crm`).
2. В разделе **«Переменные и секреты»** добавьте (как секреты, не как
   обычные переменные):
   - `GOOGLE_SHEET_ID` — ID из шага 1
   - `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` — строка из шага 2.8
   - `WEBHOOK_SECRET` — придумайте любой пароль (например, сгенерируйте
     на [passwordsgenerator.net](https://passwordsgenerator.net)) — защитит
     вебхук от посторонних запросов
3. Сделайте `git push` в ветку, которую Amvera отслеживает — Amvera сама
   соберёт и запустит сервис по файлу `amvera.yml`.
4. После деплоя Amvera покажет публичный адрес приложения, например
   `https://taina-crm.amvera.io`.

## Шаг 4. Подключить Netlify

Netlify → ваш сайт → **Site settings → Forms → Form notifications →
Add notification → Outgoing webhook**:

- URL: `https://ВАШ-АДРЕС-НА-AMVERA/webhook/netlify-lead?token=ВАШ_WEBHOOK_SECRET`
- Form: выберите вашу форму на лендинге

## Шаг 5. Проверка

Отправьте тестовую заявку через форму на сайте → проверьте, что строка
появилась в Google-таблице. Если не появилась — посмотрите логи
приложения в личном кабинете Amvera (там будет видно, на каком шаге
ошибка) и пришлите мне текст ошибки — я поправлю код, а не предложу
переделать всё заново.

## Локальный запуск (для проверки перед деплоем)

```
cp .env.example .env
# заполните .env своими значениями
npm install
npm test      # проверка логики без реального Google-аккаунта
npm start     # запуск сервера на http://localhost:3000
```
