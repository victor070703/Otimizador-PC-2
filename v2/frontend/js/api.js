/**
 * api.js — Wrapper para chamadas ao backend via Electron IPC.
 * Substitui a versão pywebview — interface idêntica para o app.js.
 */

function _call(channel, ...args) {
  return window.api.invoke(channel, ...args);
}

const API = {
  getMetrics()                    { return _call('get_metrics'); },
  getProcesses(limit = 25)        { return _call('get_processes', limit); },
  killProcess(pid)                 { return _call('kill_process', pid); },
  getServices()                   { return _call('get_services'); },
  stopService(id)                  { return _call('stop_service', id); },
  getCleanupItems()               { return _call('get_cleanup_items'); },
  cleanItem(id)                    { return _call('clean_item', id); },
  getHistory()                    { return _call('get_history'); },
  getOptimizationPreview(mode)    { return _call('get_optimization_preview', mode); },
  runOptimization(plan)            { return _call('run_optimization', plan); },
  resetRam()                       { return _call('reset_ram'); },
};
