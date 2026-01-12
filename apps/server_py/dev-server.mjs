#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverPyRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(serverPyRoot, '../..');
const serverEnvPath = join(repoRoot, 'apps/server/.env');

const loadServerEnv = () => {
  if (!existsSync(serverEnvPath)) {
    return;
  }

  const content = readFileSync(serverEnvPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
};

loadServerEnv();

const runtime = (process.env.KRONOS_SERVER_RUNTIME || 'node').toLowerCase();
const port = process.env.PORT || '3001';
const venvPython = join(serverPyRoot, '.venv/bin/python3');
const pythonBin = existsSync(venvPython) ? venvPython : 'python3';

if (runtime === 'py') {
  const child = spawn(
    pythonBin,
    [
      '-m',
      'uvicorn',
      'app.main:app',
      '--host',
      '127.0.0.1',
      '--port',
      port,
      '--reload',
    ],
    {
      cwd: serverPyRoot,
      stdio: 'inherit',
      env: process.env,
    },
  );

  child.on('exit', (code) => process.exit(code ?? 1));
} else {
  const child = spawn('pnpm', ['--filter', '@kronos/server', 'dev'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code) => process.exit(code ?? 1));
}
