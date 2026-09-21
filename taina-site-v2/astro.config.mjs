import { defineConfig } from 'astro/config';
import { FontaineTransform } from 'fontaine';

export default defineConfig({
  vite: {
    plugins: [
      FontaineTransform.vite({
        fallbacks: {
          'Cormorant Garamond': ['Georgia', 'Times New Roman'],
          Inter: ['Arial', 'Helvetica Neue'],
        },
      }),
    ],
  },
});
