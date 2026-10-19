import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env };
// Windows 上 esbuild 跨进程清理共享临时文件被拒绝，构建改用本项目的忽略目录。
if (process.platform === 'win32') {
  const temporaryDirectory = resolve(root, '.cache', 'tmp');
  mkdirSync(temporaryDirectory, { recursive: true });
  env.TEMP = temporaryDirectory;
  env.TMP = temporaryDirectory;
}
const viteDirectory = dirname(fileURLToPath(import.meta.resolve('vite/package.json')));
const result = spawnSync(process.execPath, [resolve(viteDirectory, 'bin', 'vite.js'), 'build', ...process.argv.slice(2)], {
  cwd: root, env, stdio: 'inherit',
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
