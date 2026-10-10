// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
import { spawn } from 'node:child_process';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

let output;
try {
  if (!process.env.LOCAL_SAMPLE_DIR) throw new Error('missing_directory');
  const directory = await realpath(process.env.LOCAL_SAMPLE_DIR);
  const repo = await realpath('.');
  if (directory === repo || directory.startsWith(repo + path.sep)) throw new Error('samples_must_be_external');
  output = await mkdtemp(path.join(tmpdir(), 'docredact-private-tests-'));
  const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      LOCAL_SAMPLE_DIR: directory,
      RUN_LOCAL_SAMPLES: '1',
      RUN_ACCURACY: '',
      E2E_PRODUCTION: '1',
      PRIVATE_TEST_OUTPUT_DIR: output,
      PLAYWRIGHT_NO_COPY_PROMPT: '1',
    },
  });
  const stop = () => child.kill('SIGTERM');
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  process.exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
} catch {
  console.error('Private tests could not run. Set LOCAL_SAMPLE_DIR to a readable directory outside this repository and build the app first.');
  process.exitCode = 1;
} finally {
  if (output) await rm(output, { recursive: true, force: true });
}
