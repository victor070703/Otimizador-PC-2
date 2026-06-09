const si  = require('systeminformation');
const os  = require('os');
const { exec } = require('child_process');

let _cache = {
  cpu:      { percent: 0, model: 'Carregando...', cores: 0, threads: 0 },
  ram:      { used_gb: 0, total_gb: 0, percent: 0 },
  gpu:      { name: 'N/A', percent: 0, temp: 0, available: false },
  disk:     { read_mb: 0, write_mb: 0, free_gb: 0, total_gb: 0, percent: 0 },
  disks:    [],
  platform: process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'Darwin' : 'Linux',
};

let _updating = false;

function _ps(cmd) {
  return new Promise((resolve) => {
    exec(
      `powershell -NoProfile -NonInteractive -Command "${cmd}"`,
      { timeout: 4000, windowsHide: true },
      (err, stdout) => resolve(err ? null : stdout.trim())
    );
  });
}

async function _getCpuWin() {
  const out = await _ps('(Get-CimInstance -ClassName Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average');
  const val = parseFloat(out);
  return isNaN(val) ? null : val;
}

async function _getGpuWin() {
  // Usa perfmon — mesmo método do Task Manager
  const out = await _ps(
    '(Get-Counter "\\GPU Engine(*engtype_3D)\\Utilization Percentage" -ErrorAction SilentlyContinue).CounterSamples | ' +
    'Where-Object {$_.CookedValue -gt 0} | ' +
    'Measure-Object -Property CookedValue -Sum | ' +
    'Select-Object -ExpandProperty Sum'
  );
  if (out === null) return null;
  const val = parseFloat(out.replace(',', '.'));
  return isNaN(val) ? null : Math.min(100, Math.round(val * 10) / 10);
}

async function _update() {
  if (_updating) return;
  _updating = true;
  try {
    const isWin = process.platform === 'win32';

    // CPU + GPU Windows em paralelo com si calls
    const [load, cpuInfo, mem, fsData] = await Promise.all([
      si.currentLoad(),
      si.cpu(),
      si.mem(),
      si.fsSize(),
    ]);

    // CPU
    const winCpu = isWin ? await _getCpuWin() : null;
    _cache.cpu = {
      percent: winCpu !== null ? winCpu : Math.round(load.currentLoad * 10) / 10,
      model:   `${cpuInfo.manufacturer} ${cpuInfo.brand}`.trim(),
      cores:   cpuInfo.physicalCores || cpuInfo.cores,
      threads: cpuInfo.cores,
    };

    // RAM
    _cache.ram = {
      used_gb:  Math.round(mem.active  / (1024 ** 3) * 10) / 10,
      total_gb: Math.round(mem.total   / (1024 ** 3)),
      percent:  Math.round(mem.active  / mem.total * 1000) / 10,
    };

    // GPU
    if (isWin) {
      const winGpu = await _getGpuWin();
      if (winGpu !== null) {
        const graphics = await si.graphics().catch(() => ({ controllers: [] }));
        const ctrl = (graphics.controllers || []).find(c => c.vendor && !c.vendor.toLowerCase().includes('intel')) || (graphics.controllers || [])[0];
        _cache.gpu = {
          name:      ctrl ? (ctrl.model || ctrl.vendor || 'GPU') : 'GPU',
          percent:   winGpu,
          temp:      ctrl ? (ctrl.temperatureGpu || 0) : 0,
          available: true,
        };
      }
    } else {
      try {
        const graphics = await si.graphics();
        const controllers = graphics.controllers || [];
        const dedicated = controllers.find(c => c.vendor && !c.vendor.toLowerCase().includes('intel')) || controllers[0];
        if (dedicated) {
          _cache.gpu = {
            name:      dedicated.model || dedicated.vendor || 'GPU',
            percent:   dedicated.utilizationGpu || 0,
            temp:      dedicated.temperatureGpu || 0,
            available: true,
          };
        }
      } catch (_) {}
    }

    // Disks
    const disks = (fsData || [])
      .filter(d => {
        if (d.size < 1024 ** 3) return false;
        if (process.platform === 'darwin' && d.mount.startsWith('/System/Volumes/')) return false;
        return true;
      })
      .map(d => ({
        mount:    d.mount,
        label:    d.mount,
        free_gb:  Math.round((d.size - d.used) / (1024 ** 3) * 10) / 10,
        total_gb: Math.round(d.size / (1024 ** 3) * 10) / 10,
        percent:  Math.round(d.use * 10) / 10,
      }));

    const primary = disks[0] || {};
    _cache.disk  = { read_mb: 0, write_mb: 0, free_gb: primary.free_gb || 0, total_gb: primary.total_gb || 0, percent: primary.percent || 0 };
    _cache.disks = disks;

  } catch (_) {}
  _updating = false;
}

// Inicia e repete a cada 1s
_update();
setInterval(_update, 1000);

function getAll() { return { ..._cache }; }
module.exports = { getAll };
