const si   = require('systeminformation');
const { execSync } = require('child_process');

const ICONS = {
  chrome: 'ti-brand-chrome', firefox: 'ti-brand-firefox',
  safari: 'ti-browser', code: 'ti-brand-vscode',
  node: 'ti-brand-nodejs', python: 'ti-brand-python',
  discord: 'ti-brand-discord', spotify: 'ti-music',
  default: 'ti-app',
};

// Processos do sistema que nunca devem ser encerrados
const BLOCKED = new Set([
  // Windows — shell e sistema
  'explorer.exe', 'winlogon.exe', 'wininit.exe', 'csrss.exe', 'smss.exe',
  'lsass.exe', 'services.exe', 'svchost.exe', 'system', 'system idle process',
  'registry', 'memory compression', 'secure system',
  // Windows Defender e segurança
  'msmpeng.exe', 'nissrv.exe', 'mssense.exe', 'securityhealthservice.exe',
  'antimalware service executable',
  // Runtime crítico
  'dwm.exe', 'taskeng.exe', 'taskhostw.exe', 'conhost.exe', 'sihost.exe',
  'fontdrvhost.exe', 'audiodg.exe', 'ctfmon.exe', 'spoolsv.exe',
  // macOS
  'kernel_task', 'launchd', 'loginwindow', 'windowserver', 'coreaudiod',
  'coreservicesd', 'configd', 'diskarbitrationd', 'notifyd', 'opendirectoryd',
  // Este próprio app
  'pcoptimizer', 'electron',
]);

function _isBlocked(name) {
  return BLOCKED.has((name || '').toLowerCase());
}

function _icon(name) {
  const n = (name || '').toLowerCase();
  for (const [k, v] of Object.entries(ICONS)) {
    if (n.includes(k)) return v;
  }
  return ICONS.default;
}

function _fmtBytes(b) {
  if (b >= 1024 ** 3) return `${(b / (1024 ** 3)).toFixed(1)} GB`;
  if (b >= 1024 ** 2) return `${Math.round(b / (1024 ** 2))} MB`;
  return `${Math.round(b / 1024)} KB`;
}

async function getProcesses(limit = 25) {
  const data = await si.processes();
  const procs = (data.list || [])
    .filter(p => p.pid > 4 && p.name && !_isBlocked(p.name))
    .map(p => ({
      pid:       p.pid,
      name:      p.name,
      status:    p.state || '',
      cpu:       Math.round(p.cpu * 10) / 10,
      ram_bytes: p.memRss * 1024,
      ram_label: _fmtBytes(p.memRss * 1024),
      icon:      _icon(p.name),
      blocked:   false,
    }))
    .sort((a, b) => (b.cpu + b.ram_bytes / (1024 ** 2)) - (a.cpu + a.ram_bytes / (1024 ** 2)))
    .slice(0, limit);
  return procs;
}

async function killProcess(pid) {
  try {
    // Verifica nome do processo antes de matar
    const data = await si.processes();
    const proc = (data.list || []).find(p => p.pid === pid);
    if (proc && _isBlocked(proc.name)) {
      return { success: false, message: `"${proc.name}" é um processo do sistema e não pode ser encerrado.` };
    }

    process.kill(pid, 'SIGKILL');
    return { success: true, message: `Processo ${pid} encerrado.` };
  } catch (e) {
    if (e.code === 'EPERM') {
      return { success: false, message: `Sem permissão para encerrar este processo (protegido pelo sistema).` };
    }
    return { success: false, message: `Erro: ${e.message}` };
  }
}

async function resetRam() {
  let freed = 0;
  if (process.platform === 'win32') {
    try {
      execSync(
        'powershell -NoProfile -NonInteractive -Command ' +
        '"Get-Process | ForEach-Object { $_.MinWorkingSet = 1MB; $_.MaxWorkingSet = 1MB }"',
        { timeout: 10000, windowsHide: true }
      );
    } catch (_) {}
  } else if (process.platform === 'darwin') {
    try {
      execSync('sudo -n purge', { timeout: 10000 });
    } catch (_) {}
  }

  const label = freed >= 1024 ** 3
    ? `${(freed / (1024 ** 3)).toFixed(1)} GB`
    : freed >= 1024 ** 2
    ? `${Math.round(freed / (1024 ** 2))} MB`
    : `${Math.round(freed / 1024)} KB`;

  return { success: true, freed_bytes: freed, freed_label: label || '—', errors: [] };
}

module.exports = { getProcesses, killProcess, resetRam };
