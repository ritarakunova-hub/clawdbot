// Цены и пакеты — единственный источник для Packages.astro.
// Суммы и рекомендуемость пилота — реальные данные (CLAUDE.md,
// раздел «Реальные данные»). Состав каждого пакета — [НА УТВЕРЖДЕНИЕ],
// см. docs/approve-texts.md.

export interface Package {
  id: string;
  title: string;
  price: string;
  recommended: boolean;
  // [НА УТВЕРЖДЕНИЕ]
  description: string;
}

export const packages: Package[] = [
  {
    id: 'audit',
    title: 'AI-разбор',
    price: '15 000 ₽',
    recommended: false,
    description: 'Смотрим один процесс и находим, где именно теряется время.',
  },
  {
    id: 'pilot',
    title: 'AI-пилот',
    price: '70 000 ₽',
    recommended: true,
    description: 'Собираем рабочий прототип на ваших документах — до первого результата 1–2 недели.',
  },
  {
    id: 'system',
    title: 'AI-система',
    price: 'от 150 000 ₽',
    recommended: false,
    description: 'Доводим пилот до системы, встроенной в ваши процессы и инструменты.',
  },
];

export const support = {
  title: 'Поддержка',
  price: '15 000 ₽/мес',
  // [НА УТВЕРЖДЕНИЕ]
  description: 'Наблюдаем за системой, донастраиваем и отвечаем на вопросы после запуска.',
};

// Оплаты на сайте нет — все кнопки ведут в раздел «Контакт».
export const ctaLabel = 'Обсудить';
