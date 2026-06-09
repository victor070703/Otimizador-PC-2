const si = require('systeminformation');
const os = require('os');

let _cache = {
  cpu:      { percent: 0, model: 'Carregando...', cores: 0, threads: 0 },
  ram:      { used_gb: 0, total_gb: 0, percent: 0 },
  gpu:      { name: 'N/A', percent: 0, temp: 0, available: false },
  disk:     { read_mb: 0, write_mb: 0, free_gb: 0, total_gb: 0, percent: 0 },
  disks:    [],
  platform: process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'Darwin' : 'Linux',
};

let _prevDiskIO = null;

async function _update() {
  try {
    // CPU
    const [load, cpuInfo] = await Promise.all([
      si.currentLoad(),
      si.cpu(),
    ]);
    _cache.cpu = {
      percent: Math.round(load.currentLoad * 10) / 10,
      model:   `${cpuInfo.manufacturer} ${cpuInfo.brand}`.trim(),
      cores:   cpuInfo.physicalCores || cpuInfo.cores,
      threads: cpuInfo.cores,
    };

    // RAM
    const mem = await si.mem();
    _cache.ram = {
      used_gb:  Math.round(mem.active  / (1024 ** 3) * 10) / 10,
      total_gb: Math.round(mem.total   / (1024 ** 3)),
      percent:  Math.round(mem.active  / mem.total * 1000) / 10,
    };

    // GPU
    try {
      const graphics = await si.graphics();
      const controllers = graphics.controllers || [];
      // Prefer dedicated GPU (not Intel integrated)
      const dedicated = controllers.find(c => c.vendor && !c.vendor.toLowerCase().includes('intel')) || controllers[0];
      if (dedicated) {
        const pct  = dedicated.utilizationGpu  || 0;
        const temp = dedicated.temperatureGpu  || 0;
        _cache.gpu = {
          name:      dedicated.model || dedicated.vendor || 'GPU',
          percent:   pct,
          temp:      temp,
          available: pct > 0 || temp > 0,
        };
      }
    } catch (_) {}

    // Disk I/O
    let read_mb = 0, write_mb = 0;
    try {
      const curr = await si.disksIO();
      if (_prevDiskIO && curr) {
        read_mb  = Math.max(0, (curr.rIO_sec  || 0) * 512 / (1024 ** 2));
        write_mb = Math.max(0, (curr.wIO_sec  || 0) * 512 / (1024 ** 2));
      }
      _prevDiskIO = curr;
    } catch (_) {}

    // Disks
    try {
      const fsData = await si.fsSize();
      const disks = fsData
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
      _cache.disk = {
        read_mb:  Math.round(read_mb  * 10) / 10,
        write_mb: Math.round(write_mb * 10) / 10,
        free_gb:  primary.free_gb  || 0,
        total_gb: primary.total_gb || 0,
        percent:  primary.percent  || 0,
      };
      _cache.disks = disks;
    } catch (_) {}

  } catch (e) {
    // silently ignore
  }
}

// Atualiza a cada 1s
setInterval(_update, 1000);
_update();

function getAll() {
  return { ..._cache };
}

module.exports = { getAll };
