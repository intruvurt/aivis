const { existsSync } = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

const clientRoot = path.resolve(__dirname, '..');

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: clientRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function platformExists(platform) {
  return existsSync(path.join(clientRoot, platform));
}

run('npm', ['run', 'mobile:assets']);

if (!platformExists('android')) {
  run('npm', ['exec', '--yes', '--package', '@capacitor/cli', '--', 'cap', 'add', 'android']);
}

if (!platformExists('ios')) {
  run('npm', ['exec', '--yes', '--package', '@capacitor/cli', '--', 'cap', 'add', 'ios']);
}

run('npm', ['run', 'build']);
run('npm', ['exec', '--yes', '--package', '@capacitor/cli', '--', 'cap', 'sync']);

console.log(' Mobile scaffold prepared: assets generated, platforms present, sync complete.');
