const { execSync } = require('child_process');

const args = process.argv.slice(2).join(' ');
execSync(`npx ${args}`, { stdio: 'inherit' });
