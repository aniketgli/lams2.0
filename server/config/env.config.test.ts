import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ENV_VARIABLES, envConfig } from './env.config';

const root = join(import.meta.dir, '..', '..');

/** Every .ts / .tsx file under a folder, skipping dependencies. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name === 'dist') return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('environment settings', () => {
  test('.env.example documents every variable the server reads', () => {
    const example = readFileSync(join(root, '.env.example'), 'utf8');
    for (const name of ENV_VARIABLES) expect(example).toMatch(new RegExp(`^#?\\s*${name}=`, 'm'));
  });

  test('only the env config module reads process.env (tools, scripts and tests excepted)', () => {
    const offenders = [...sourceFiles(join(root, 'server')), ...sourceFiles(join(root, 'src'))]
      .filter((file) => !/\.test\.tsx?$/.test(file) && !file.endsWith(join('config', 'env.config.ts')))
      .filter((file) => /process\.env/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(root, file));
    expect(offenders).toEqual([]);
  });

  test('invalid numbers fall back to safe defaults', () => {
    const saved = process.env.DB_POOL_SIZE;
    process.env.DB_POOL_SIZE = 'abc';
    expect(envConfig.dbPoolSize).toBe(40);
    process.env.DB_POOL_SIZE = '25';
    expect(envConfig.dbPoolSize).toBe(25);
    if (saved === undefined) delete process.env.DB_POOL_SIZE; else process.env.DB_POOL_SIZE = saved;
  });
});
