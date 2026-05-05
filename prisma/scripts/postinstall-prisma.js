const { spawnSync } = require('child_process');

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    process.env.NODE_ENV === 'production'
      ? 'file:/tmp/dev.db'
      : 'file:./prisma/dev.db';
}

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(command, ['prisma', 'generate'], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);