// Browser tests for the real app (tests/e2e). Run: npm run test:e2e
import {defineConfig, devices} from '@playwright/test';

const PORT = 4174;
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  // rendering the room and loading her model is slow on shared CI machines
  expect: {timeout: process.env.CI ? 30_000 : 10_000},
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', {open: 'never'}]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // WebGL through SwiftShader, so the 3D village and the reading room render without a GPU
    launchOptions: {args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']}
  },
  projects: [
    {name: 'phone', use: {...devices['iPhone 13'], browserName: 'chromium'}},
    {name: 'desktop', use: {viewport: {width: 1280, height: 860}, browserName: 'chromium'}}
  ],
  webServer: {command: `node tools/serve.mjs ${PORT}`, port: PORT, reuseExistingServer: !process.env.CI}
});
