/**
 * メインプロセス
 */
const electron = require('electron');
const ipcMain = electron.ipcMain;

let app = electron.app;
let BrowserWindow = electron.BrowserWindow;
let mainWindow;

app.on('window-all-closed', function() {
  if (process.platform != 'darwin')
    app.quit();
});

app.on('ready', function() {
  mainWindow = new BrowserWindow({width: 600, height: 680});
  mainWindow.loadURL('file://' + __dirname + '/index.html');
  mainWindow.webContents.on('did-finish-load', () => { 
      //load後に実施したい処理はここに書く
  });

  mainWindow.on('closed', function() {
    mainWindow = null;
  });
});

