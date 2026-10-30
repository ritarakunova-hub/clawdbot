// Появление контента при скролле — общая утилита для всех обычных
// (не-3D) секций после хиро. Один IntersectionObserver на всю страницу:
// элемент с [data-reveal] получает класс .is-in, как только входит в
// область просмотра, и дальше не отслеживается — появление один раз, не
// повторяется при скролле вверх-вниз (см. .js-motion в base.css).
//
// Без JS (уровень D) всё видно сразу: класс .js-motion, который прячет
// [data-reveal] в CSS, ставит только эта функция — сгенерированный на
// сервере HTML его не содержит.
//
// prefers-reduced-motion и кнопка «Остановить анимацию» (lib/a11y.ts) —
// весь контент показывается сразу, без ожидания скролла, и обе причины
// отслеживаются живьём: если пользователь остановит анимацию уже после
// старта, всё, что ещё не появилось, показывается немедленно.

import { isReducedMotion, onMotionChange } from './a11y';

let observer: IntersectionObserver | null = null;

function revealAll(): void {
  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    el.classList.add('is-in');
  });
  observer?.disconnect();
  observer = null;
}

export function initScrollReveal(): void {
  if (typeof document === 'undefined') return;
  const elements = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (elements.length === 0) return;

  if (isReducedMotion()) {
    // .js-motion не ставим вовсе — элементы остаются видимыми, как без JS.
    // Если движение потом включат обратно — контент уже показан, прятать
    // его задним числом и переигрывать появление не нужно.
    return;
  }

  document.documentElement.classList.add('js-motion');

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        observer?.unobserve(entry.target);
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
  );

  elements.forEach((el) => observer?.observe(el));

  onMotionChange(() => {
    if (isReducedMotion()) revealAll();
  });
}
