const processes = require('./processes');
const services  = require('./services');
const cleanup   = require('./cleanup');
const history   = require('./history');

function _fmt(b) {
  if (b >= 1024 ** 3) return `${(b / (1024 ** 3)).toFixed(1)} GB`;
  if (b >= 1024 ** 2) return `${Math.round(b / (1024 ** 2))} MB`;
  return `${Math.round(b / 1024)} KB`;
}

async function getPreview(mode = 'gaming') {
  const allProcs  = await processes.getProcesses(30);
  const heavy     = allProcs
    .filter(p => p.cpu > 3 || p.ram_bytes > 100 * 1024 * 1024)
    .sort((a, b) => b.ram_bytes - a.ram_bytes)
    .slice(0, 6);

  const allSvcs   = services.getServices();
  const running   = allSvcs.filter(s => s.running);
  const cleanItems = cleanup.getCleanableItems();

  const estRam  = heavy.reduce((s, p) => s + p.ram_bytes, 0);
  const estDisk = cleanItems.reduce((s, c) => s + c.size_bytes, 0);

  return {
    mode,
    processes:            heavy,
    services:             running,
    cleanup:              cleanItems,
    estimated_ram_label:  _fmt(estRam),
    estimated_disk_label: _fmt(estDisk),
    estimated_ram_bytes:  estRam,
    estimated_disk_bytes: estDisk,
  };
}

async function run(plan) {
  const killed = [], stopped = [], cleaned = [], errors = [];
  let freedDisk = 0;

  for (const pid of (plan.kill_pids || [])) {
    const r = await processes.killProcess(parseInt(pid));
    (r.success ? killed : errors).push(r.message);
  }

  for (const id of (plan.stop_service_ids || [])) {
    const r = services.stopService(id);
    (r.success ? stopped : errors).push(r.message);
  }

  for (const id of (plan.clean_item_ids || [])) {
    const r = cleanup.cleanItem(id);
    if (r.success) { cleaned.push(r.message); freedDisk += r.freed_bytes || 0; }
    else errors.push(r.message);
  }

  history.add({
    mode:             plan.mode || 'custom',
    summary:          `${killed.length} processo(s) · ${stopped.length} serviço(s) · ${cleaned.length} item(s) limpo(s)`,
    killed:           killed.length,
    stopped:          stopped.length,
    cleaned:          cleaned.length,
    freed_disk_label: _fmt(freedDisk),
  });

  return { killed, stopped, cleaned, errors, freed_disk_label: _fmt(freedDisk) };
}

module.exports = { getPreview, run };
