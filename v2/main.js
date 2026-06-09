const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const si   = require('systeminformation');

const system    = require('./backend/system');
const processes = require('./backend/processes');
const services  = require('./backend/services');
const cleanup   = require('./backend/cleanup');
const history   = require('./backend/history');
const optimizer = require('./backend/optimizer');

let win;

function createWindow() {
  win = new BrowserWindow({
    width:     960,
    height:    640,
    minWidth:  800,
    minHeight: 560,
    title:     'PC Optimizer',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  win.loadFile(path.join(__dirname, 'frontend', 'index.html'));
  win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC Handlers ─────────────────────────────────────────────

ipcMain.handle('get_metrics',              async () => system.getAll());
ipcMain.handle('get_processes',            async (_, limit) => processes.getProcesses(limit || 25));
ipcMain.handle('kill_process',             async (_, pid) => processes.killProcess(pid));
ipcMain.handle('get_services',             async () => services.getServices());
ipcMain.handle('stop_service',             async (_, id) => services.stopService(id));
ipcMain.handle('get_cleanup_items',        async () => cleanup.getCleanableItems());
ipcMain.handle('clean_item',               async (_, id) => cleanup.cleanItem(id));
ipcMain.handle('get_history',              async () => history.load());
ipcMain.handle('get_optimization_preview', async (_, mode) => optimizer.getPreview(mode));
ipcMain.handle('run_optimization',         async (_, plan) => optimizer.run(plan));
ipcMain.handle('reset_ram',                async () => processes.resetRam());
