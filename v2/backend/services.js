const { execSync } = require('child_process');
const os = require('os');

const MACOS_SERVICES = [
  { id: 'spotlight',       name: 'Spotlight',          desc: 'Indexação de ficheiros',       label: 'com.apple.metadata.mds',          icon: 'ti-search' },
  { id: 'icloud_drive',    name: 'iCloud Drive',        desc: 'Sincronização iCloud',         label: 'com.apple.cloudd',                icon: 'ti-cloud' },
  { id: 'photo_analysis',  name: 'Análise de Fotos',    desc: 'Processamento de imagens',     label: 'com.apple.photoanalysisd',        icon: 'ti-photo' },
  { id: 'siri_suggestions',name: 'Sugestões Siri',      desc: 'Sugestões e aprendizagem',     label: 'com.apple.suggestd',              icon: 'ti-microphone' },
  { id: 'cloudd',          name: 'CloudKit Daemon',     desc: 'Sincronização CloudKit',       label: 'com.apple.cloudd',                icon: 'ti-cloud-upload' },
  { id: 'knowledge_agent', name: 'Knowledge Agent',     desc: 'Base de dados de actividade',  label: 'com.apple.knowledge-agent',       icon: 'ti-brain' },
];

const WINDOWS_SERVICES = [
  { id: 'wuauserv',    name: 'Windows Update',    desc: 'Actualizações automáticas',   icon: 'ti-refresh' },
  { id: 'Spooler',     name: 'Print Spooler',     desc: 'Gestão de impressão',          icon: 'ti-printer' },
  { id: 'WSearch',     name: 'Windows Search',    desc: 'Indexação de ficheiros',       icon: 'ti-search' },
  { id: 'SysMain',     name: 'SysMain',           desc: 'Pré-carregamento de apps',     icon: 'ti-database' },
  { id: 'DiagTrack',   name: 'Telemetria',        desc: 'Dados de diagnóstico',         icon: 'ti-chart-bar' },
  { id: 'Fax',         name: 'Fax',               desc: 'Serviço de fax',               icon: 'ti-device-floppy' },
];

function _isRunningMac(label) {
  try {
    const out = execSync(`launchctl list | grep "${label}"`, { timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
    return out.trim().length > 0;
  } catch (_) { return false; }
}

function _isRunningWin(id) {
  try {
    const out = execSync(`sc query "${id}"`, { timeout: 3000, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
    return out.includes('RUNNING');
  } catch (_) { return false; }
}

function getServices() {
  const isWin = process.platform === 'win32';
  const list  = isWin ? WINDOWS_SERVICES : MACOS_SERVICES;

  return list.map(s => {
    const running = isWin ? _isRunningWin(s.id) : _isRunningMac(s.label || s.id);
    return {
      ...s,
      running,
      status: running ? 'Em execução' : 'Parado',
    };
  });
}

function stopService(id) {
  try {
    if (process.platform === 'win32') {
      execSync(`sc stop "${id}"`, { timeout: 5000, windowsHide: true });
    } else {
      const svc = MACOS_SERVICES.find(s => s.id === id);
      const label = svc ? svc.label : id;
      execSync(`launchctl stop "${label}"`, { timeout: 5000 });
    }
    return { success: true, message: `Serviço ${id} parado.` };
  } catch (e) {
    return { success: false, message: `Erro ao parar ${id}: ${e.message}` };
  }
}

module.exports = { getServices, stopService };
