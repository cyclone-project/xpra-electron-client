const electron = require('electron');
const {Tray, dialog} = require('electron');
const {ipcMain} = require('electron');
const path = require('path');
// Module to control application life.
const app = electron.app;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

const Connection = require('./lib/xpra').Connection;
const XpraConnection = require('./lib/xpra').XpraConnection;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let loginWindow;
let client;

function createWindow() {

    let client = new Connection();
    client.isInstalled()
        .then((success) => {
            if (!success) {
                dialog.showErrorBox(
                    'xPra not found in your system',
                    'Please install xPra in order to use xPra X11/Remote Desktop connection');
            }
        });

    // Create the browser window.
    loginWindow = new BrowserWindow({
        width: 600,
        height: 300,
        title: 'Log In'
    });

    //loginWindow.setMenu(null);

    // and load the login.html of the app.
    loginWindow.loadURL(`file://${__dirname}/app/pages/login.html`);

    // Emitted when the window is closed.
    loginWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        loginWindow = null
    })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

let tray = null;
app.on('ready', () => {
    if (tray === null && process.platform !== 'darwin') {
        tray = new Tray(path.join(`${__dirname}/app/theme`, 'tray_logo.ico'));
        tray.setToolTip('Cyclone service running');
    }

});

// Detect if the app is already running and do not start it again,
// just recreate the login window in the existing instance
 var iShouldQuit = app.makeSingleInstance(() => {
    if (loginWindow == null) {
        createWindow();
    }
    else {
        loginWindow.focus();
    }
});

if (iShouldQuit) {app.quit();return;}

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
});

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (loginWindow === null) {
        createWindow()
    }
});

ipcMain.on('successful-login', function (event, arg) {

    client = new Connection();

    new XpraConnection(arg.username, arg.server, 0, arg.remotePort)
        .init()
        .then((connection) => client
                .startTunnel(connection)
                .then(() => client.startXpra(connection))
        )
        .then(() => loginWindow.restore())
        .then(() => loginWindow.send('connection-started'))
});

ipcMain.on('disconnect', () => {
    client.disconnect()
        .then(() => loginWindow.send('connection-ended'))
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
