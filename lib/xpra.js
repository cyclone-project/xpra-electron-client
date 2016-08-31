'use strict';

const Exec = require('child_process').exec;
const app = require('electron').app;
const BrowserWindow = require('electron').BrowserWindow;
const Fs = require('fs');
const Promise = require("bluebird");
const PortFinder = Promise.promisifyAll(require('portfinder'));


const xpraDarwinPath = '/Applications/Xpra.app/Contents/MacOS/';
const xpraUnixPath = '';
const xpraWinPath = '';

const sshDarwinPath = 'ssh';
const sshUnixPath = 'ssh';
const sshWinPath = `"${__dirname}\\plink"`;

class XpraConnection {

    constructor(user, remoteHost, password, screenNumber) {
        this.user = user;
        this.remoteHost = remoteHost;
        this.screenNumber = (typeof screenNumber === 'undefined') ? 1 : screenNumber;
        this.password = password;
        this.remotePort = 10000;
    }

    init() {

        return PortFinder.getPortAsync()
            .then((result) => {
                this.localPort = result;
                return this;
            });
    }
}

class Xpra {

    constructor() {
        this.platform = process.platform;
        this.createPath();
    }

    createPath() {
        switch (this.platform) {
            case 'win32':
                this.xpraPath = xpraWinPath + 'Xpra';
                this.sshPath = sshWinPath;
                break;

            case 'darwin':
                this.xpraPath = xpraDarwinPath + 'Xpra';
                this.sshPath = sshDarwinPath;
                break;

            case 'linux':
                this.xpraPath = xpraUnixPath + 'Xpra';
                this.sshPath = sshUnixPath;
                break;

            default:
            //TODO throw error
        }
    }

    isInstalled() {
        return new Promise((resolve) => {
            Fs.exists(this.xpraPath, resolve);
        });
    }

    start(conn) {

        this.success = false;
        this.authenticating = false;

        const script = `${this.sshPath} -L ${conn.localPort}:localhost:${conn.remotePort} ${conn.user}@${conn.remoteHost}`;

        // Start SSH tunnel
        var child = Exec (script);
        var mainWindow = {};

        // Follow stdout to see the output of Plink
        child.stdout.on('data', (data) => {
            let url = /Browse to (http:\/\/.+:\d{1,6}) to login/g.exec(data);
            if (url && url.length === 2) {
                this.authenticating = true;
                // Accept the notification to trigger the start of the server
                child.stdin.write(`\n`);

                // Open the page in a new Browser window
                mainWindow = new BrowserWindow();
                mainWindow.loadURL(url[1]);
                return;
            }
            if (/User has been authenticated in eduGAIN network/.test(data) && this.authenticating) {
                this.authenticating = false;
                this.success = true;
                mainWindow.close();
                console.log('SSH Tunnel Created');
            }
        });

        child.stderr.on('data', (data) => {
            if (!this.success)
                console.log('Problem logging in the server')
        });
    }

}

exports.Xpra = Xpra;
exports.XpraConnection = XpraConnection;
