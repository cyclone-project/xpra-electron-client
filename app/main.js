const electron = require('electron');
const {Tray, dialog, Menu} = require('electron');
const {ipcMain} = require('electron');
const path = require('path');
const co = require('co');
const sleep = require('co-sleep');
// Module to control application life.
const app = electron.app;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

const Client = require('./lib/ssh');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let loginWindow;
let loadingWindow;
let xpraWindow;
let client;
let server;

function createLoginWindow() {

    // Create the browser window.
    loginWindow = new BrowserWindow({
        width: 600,
        height: 300,
        title: 'Log In'
    });

    //loginWindow.setMenu(null);

    // and load the login.html of the app.
    loginWindow.loadURL(`file://${__dirname}/pages/login/login.html`);

    // Emitted when the window is closed.
    loginWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        loginWindow = null
    })
}

function createLoadingWindow() {

    loadingWindow = new BrowserWindow({
        width: 600,
        height: 300,
        title: 'Loading'
    });

    loadingWindow.loadURL(`file://${__dirname}/pages/loading/loading.html`);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createLoginWindow);

let tray = null;
app.on('ready', () => {
    if (tray === null && process.platform !== 'darwin') {
        tray = new Tray(path.join(`${__dirname}/theme`, 'tray_logo.ico'));
        tray.setToolTip('Cyclone service running');

        const contextMenu = Menu.buildFromTemplate(
            [{
                 label: 'Close',
                click (){
                     app.quit()
                }
                }]);
        tray.setContextMenu(contextMenu);
    }

});

// Detect if the app is already running and do not start it again,
// just recreate the login window in the existing instance
 let iShouldQuit = app.makeSingleInstance(() => {
    if (loginWindow == null) {
        createLoginWindow();
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
        createLoginWindow()
    }
});

ipcMain.on('successful-login', function (event, arg) {

    co(function *(){

        createLoadingWindow();

        let config = {
            host: arg.server,
            username: arg.username,
            localPort: arg.localPort,
            remoteHost: arg.server,
            remotePort: arg.remotePort,
            xProgram: 'xterm'
        };

        if (config.localPort == "")
            config.localPort = yield Client.getAvailablePort();

        if (config.remotePort == "")
            config.remotePort = yield Client.getAvailablePort();

        let x11 = arg.selectedForm == 'x11';
        let tunnel = arg.selectedForm == 'sshTunnel';


        let ssh = yield Client.createConnection(config);
        loadingWindow.close();
        let authenticateWindow = new BrowserWindow();
        authenticateWindow.loadURL(ssh.url);

        // Wait for the login to be successful
        client = yield ssh.sshPromise;
        authenticateWindow.close();

        createLoadingWindow();

        if (tunnel || x11) {
            server = yield Client.createTunnel(client, config);
        }
        if (x11) {
            yield Client.setupX11(client, config);
            yield sleep(1000);
            xpraWindow = new BrowserWindow({
                webPreferences: {
                    nodeIntegration: false
                }
            });
            loadingWindow.close();
            xpraWindow.loadURL(`http://localhost:${config.localPort}`);
        }
        loginWindow.x = 0;
        loginWindow.y = 0;
        loginWindow.send('connection-started');
    })


});

ipcMain.on('disconnect', () => {

    co(function *(){

        try {
            // Close window
            xpraWindow.close();
            xpraWindow = null;

            // Close network
            if (server !== null) {
                server.close();
                server = null;
            }

            // Close connection
            yield Client.closeConnection(client);
            client = null;
        }
        catch (e) {
            console.log(e);
        }

        yield loginWindow.send('connection-ended');

    })
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
