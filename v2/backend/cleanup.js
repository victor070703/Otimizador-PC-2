const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execSync } = require('child_process');

function _dirSize(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return 0;
    if (process.platform === 'win32') {
      const out = execSync(`powershell -NoProfile -NonInteractive -Command "(Get-ChildItem '${dirPath}' -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum"`, { timeout: 8000, windowsHide: true }).toString().trim();
      return parseInt(out) || 0;
    } else {
      const out = execSync(`du -sk "${dirPath}" 2>/dev/null`, { timeout: 8000 }).toString();
      return (parseInt(out) || 0) * 1024;
    }
  } catch (_) { return 0; }
}

function _fmtBytes(b) {
  if (b >= 1024 ** 3) return `${(b / (1024 ** 3)).toFixed(1)} GB`;
  if (b >= 1024 ** 2) return `${Math.round(b / (1024 ** 2))} MB`;
  return `${Math.round(b / 1024)} KB`;
}

function _getItems() {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return [
      { id: 'user_caches', name: 'Cache de Apps',    path: path.join(home, 'Library', 'Caches'),  icon: 'ti-stack',     desc: '~/Library/Caches' },
      { id: 'user_logs',   name: 'Logs',             path: path.join(home, 'Library', 'Logs'),    icon: 'ti-file-text', desc: '~/Library/Logs' },
      { id: 'trash',       name: 'Lixeira',          path: path.join(home, '.Trash'),             icon: 'ti-trash',     desc: '~/.Trash' },
    ];
  } else {
    return [
      { id: 'user_temp',   name: 'Temporários',      path: process.env.TEMP || path.join(os.tmpdir()), icon: 'ti-stack',     desc: '%TEMP%' },
      { id: 'system_temp', name: 'Temp do Sistema',  path: 'C:\\Windows\\Temp',                        icon: 'ti-file-text', desc: 'C:\\Windows\\Temp' },
    ];
  }
}

function getCleanableItems() {
  return _getItems().map(item => {
    const size = _dirSize(item.path);
    return { ...item, size_bytes: size, size_label: _fmtBytes(size) };
  });
}

function cleanItem(id) {
  const item = _getItems().find(i => i.id === id);
  if (!item) return { success: false, message: 'Item não encontrado.', freed_bytes: 0 };

  try {
    const before = _dirSize(item.path);
    if (!fs.existsSync(item.path)) return { success: true, message: 'Já estava limpo.', freed_bytes: 0 };

    const entries = fs.readdirSync(item.path);
    let removed = 0;
    for (const entry of entries) {
      try {
        const full = path.join(item.path, entry);
        fs.rmSync(full, { recursive: true, force: true });
        removed++;
      } catch (_) {}
    }
    const after  = _dirSize(item.path);
    const freed  = Math.max(0, before - after);
    return { success: true, message: `${item.name} limpo (${removed} itens).`, freed_bytes: freed };
  } catch (e) {
    return { success: false, message: `Erro: ${e.message}`, freed_bytes: 0 };
  }
}

module.exports = { getCleanableItems, cleanItem };
