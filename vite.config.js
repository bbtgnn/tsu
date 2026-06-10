import { defineConfig } from 'vite';

// GitHub project pages are served from https://<user>.github.io/<repo>/
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
});
