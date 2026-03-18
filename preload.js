'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('netbyte', {
  // Preferences
  getPrefs:          ()      => ipcRenderer.invoke('get-prefs'),
  savePrefs:         (prefs) => ipcRenderer.invoke('save-prefs', prefs),

  // Ad blocker stats
  getBlockedCount:   ()      => ipcRenderer.invoke('get-blocked-count'),
  resetBlockedCount: ()      => ipcRenderer.invoke('reset-blocked-count'),
  onBlockedCount:    (fn)    => ipcRenderer.on('blocked-count', (_, n) => fn(n)),

  // Extensions
  openExtensionDir:  ()      => ipcRenderer.invoke('open-extension-dir'),
  reloadExtensions:  ()      => ipcRenderer.invoke('reload-extensions'),
  listExtensions:    ()      => ipcRenderer.invoke('list-extensions'),

  // Window controls
  minimize:          ()      => ipcRenderer.invoke('minimize-window'),
  maximize:          ()      => ipcRenderer.invoke('maximize-window'),
  close:             ()      => ipcRenderer.invoke('close-window'),

  // Dialogs
  showSaveDialog:    (opts)  => ipcRenderer.invoke('show-save-dialog', opts),
  showOpenDialog:    (opts)  => ipcRenderer.invoke('show-open-dialog', opts),

  // Info
  getVersion:        ()      => ipcRenderer.invoke('get-version'),

  // Platform
  platform: process.platform,
});
