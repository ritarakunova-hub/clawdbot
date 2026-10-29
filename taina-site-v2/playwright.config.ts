import { defineConfig, devices } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PORT = 4321;
// Путь к Chromium в песочнице меняется между сессиями (версия в имени
// папки обновляется вместе с окружением) — ищем реальный бинарник вместо
// того, чтобы хранить версию в коде.
function findSandboxChromium(): string | undefined {
  const base = '/opt/pw-browsers';
  if (!existsSync(base)) return undefined;
  for (const entry of readdirSync(base)) {
    if (!entry.startsWith('chromium-')) continue;
    for (const sub of ['chrome-linux64', 'chrome-linux']) {
      const candidate = join(base, entry, sub, 'chrome');
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}
const CHROMIUM_PATH = findSandboxChromium();
// SwiftShader — программный WebGL2, нужен в headless-окружениях без GPU
// (CI, песочница). На реальном железе с GPU эти флаги ничего не портят.
const SWIFTSHADER_ARGS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--enable-webgl',
  '--enable-webgl2',
];

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    // astro preview в этом окружении сам уходит в фон (демонизируется) и
    // печатает статус — команда должна остаться на переднем плане, иначе
    // Playwright считает процесс упавшим. `sleep infinity` держит обёртку
    // живой, пока превью-сервер работает как отдельный демон.
    command: `npm run build && npm run preview -- --port ${PORT} && sleep infinity`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium-swiftshader',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          executablePath: CHROMIUM_PATH,
          args: SWIFTSHADER_ARGS,
        },
      },
    },
  ],
});
