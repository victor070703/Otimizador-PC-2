const fs   = require('fs');
const path = require('path');
const os   = require('os');

const FILE     = path.join(os.homedir(), '.pc_optimizer_history.json');
const MAX      = 50;

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (_) { return []; }
}

function add(entry) {
  const entries = load();
  const now = new Date();
  const ts  = `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
  entries.unshift({ timestamp: ts, ...entry });
  const trimmed = entries.slice(0, MAX);
  try { fs.writeFileSync(FILE, JSON.stringify(trimmed, null, 2), 'utf8'); } catch (_) {}
}

module.exports = { load, add };
