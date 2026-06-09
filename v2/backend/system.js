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

let _updating   = false;
let _gpuName    = null;    // cacheado uma vez
let _hasNvidia  = null;    // null = ainda não testado

// ── CPU via Win32_Processor (mesmo valor do Task Manager) ──────
function _cpuWin() {
  return new Promise((resolve) => {
    exec(
      'powershell -NoProfile -NonInteractive -Command "(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average"',
      { timeout: 3500, windowsHide: true },
      (err, stdout) => {
        if (err || !stdout) return resolve(null);
        const v = parseFloat(stdout.trim().replace(',', '.'));
        resolve(isNaN(v) ? null : Math.round(v * 10) / 10);
      }
    );
  });
}

// ── GPU via nvidia-smi (valor idêntico ao Task Manager) ───────
function _gpuNvidia() {
  return new Promise((resolve) => {
    exec(
      'nvidia-smi --query-gpu=utilization.gpu,temperature.gpu,name --format=csv,noheader,nounits',
      { timeout: 3500, windowsHide: true },
      (err, stdout) => {
        if (err || !stdout) return resolve(null);
        const parts = stdout.trim().split('\n')[0].split(',').map(s => s.trim());
        const util = parseFloat(parts[0]);
        const temp = parseFloat(parts[1]);
        if (isNaN(util)) return resolve(null);
        resolve({ percent: Math.round(util * 10) / 10, temp: isNaN(temp) ? 0 : temp, name: parts[2] || 'NVIDIA GPU' });
      }
    );
  });
}

// ── GPU via perfmon (fallback p/ AMD/Intel) ───────────────────
function _gpuPerfmon() {
  return new Promise((resolve) => {
    exec(
      'powershell -NoProfile -NonInteractive -Command "$s=(Get-Counter \'\\GPU Engine(*engtype_3D)\\Utilization Percentage\' -ErrorAction SilentlyContinue).CounterSamples; if($s){($s | Measure-Object -Property CookedValue -Sum).Sum}else{0}"',
      { timeout: 3500, windowsHide: true },
      (err, stdout) => {
        if (err || !stdout) return resolve(null);
        const v = parseFloat(stdout.trim().replace(',', '.'));
        resolve(isNaN(v) ? null : Math.min(100, Math.round(v * 10) / 10));
      }
    );
  });
}

async function _update() {
  if (_updating) return;
  _updating = true;
  try {
    const isWin = process.platform === 'win32';

    const [load, cpuInfo, mem, fsData] = await Promise.all([
      si.currentLoad(),
      si.cpu(),
      si.mem(),
      si.fsSize(),
    ]);

    // Nome da GPU — busca uma vez só (lento)
    if (_gpuName === null) {
      try {
        const g = await si.graphics();
        const ctrl = (g.controllers || []).find(c => c.vendor && !c.vendor.toLowerCase().includes('intel')) || (g.controllers || [])[0];
        _gpuName = ctrl ? (ctrl.model || ctrl.vendor || 'GPU') : 'GPU';
      } catch (_) { _gpuName = 'GPU'; }
    }

    if (isWin) {
      // CPU e GPU em paralelo (chamadas rápidas)
      const nvidiaCall = _hasNvidia === false ? Promise.resolve(null) : _gpuNvidia();
      const [cpuPct, nvidia] = await Promise.all([_cpuWin(), nvidiaCall]);

      _cache.cpu = {
        percent: cpuPct !== null ? cpuPct : Math.round(load.currentLoad * 10) / 10,
        model:   `${cpuInfo.manufacturer} ${cpuInfo.brand}`.trim(),
        cores:   cpuInfo.physicalCores || cpuInfo.cores,
        threads: cpuInfo.cores,
      };

      if (nvidia) {
        _hasNvidia = true;
        _cache.gpu = { name: nvidia.name, percent: nvidia.percent, temp: nvidia.temp, available: true };
      } else {
        if (_hasNvidia === null) _hasNvidia = false;  // sem nvidia-smi → usa perfmon
        const pct = await _gpuPerfmon();
        _cache.gpu = { name: _gpuName, percent: pct !== null ? pct : 0, temp: 0, available: true };
      }
    } else {
      _cache.cpu = {
        percent: Math.round(load.currentLoad * 10) / 10,
        model:   `${cpuInfo.manufacturer} ${cpuInfo.brand}`.trim(),
        cores:   cpuInfo.physicalCores || cpuInfo.cores,
        threads: cpuInfo.cores,
      };
      try {
        const g = await si.graphics();
        const ctrl = (g.controllers || []).find(c => c.vendor && !c.vendor.toLowerCase().includes('intel')) || (g.controllers || [])[0];
        if (ctrl) {
          _cache.gpu = {
            name:      ctrl.model || ctrl.vendor || 'GPU',
            percent:   ctrl.utilizationGpu || 0,
            temp:      ctrl.temperatureGpu || 0,
            available: true,
          };
        }
      } catch (_) {}
    }

    // RAM
    _cache.ram = {
      used_gb:  Math.round(mem.active / (1024 ** 3) * 10) / 10,
      total_gb: Math.round(mem.total  / (1024 ** 3)),
      percent:  Math.round(mem.active / mem.total * 1000) / 10,
    };

    // Discos
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

_update();
setInterval(_update, 1000);

function getAll() { return { ..._cache }; }
module.exports = { getAll };
