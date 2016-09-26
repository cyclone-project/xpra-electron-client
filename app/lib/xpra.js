'use strict';

const Spawn = require('child_process').spawn;
const app = require('electron').app;
const BrowserWindow = require('electron').BrowserWindow;
const Fs = require('fs');
const Promise = require("bluebird");
const PortFinder = Promise.promisifyAll(require('portfinder'));


const xpraDarwinPath = '/Applications/SshTunnel.app/Contents/MacOS/';
const xpraUnixPath = '';
const xpraWinPath = 'C:\\Program Files (x86)\\Xpra\\Xpra_cmd.exe';

const sshDarwinPath = 'ssh';
const sshUnixPath = 'ssh';
const sshWinPath = `${__dirname}\\plink.exe`;

class XpraConnection {

    constructor(user, remoteHost, screenNumber, remotePort) {
        this.user = user;
        this.remoteHost = remoteHost;
        this.screenNumber = (typeof screenNumber === 'undefined') ? 1 : screenNumber;
        this.remotePort = remotePort;
    }

    init() {

        return PortFinder.getPortAsync()
            .then((result) => {
                this.localPort = result;
                return this;
            });
    }
}

class Connection {

    constructor() {
        this.platform = process.platform;
        this.createPath();
    }

    createPath() {
        switch (this.platform) {
            case 'win32':
                this.xpraPath = xpraWinPath;
                this.sshPath = sshWinPath;
                break;

            case 'darwin':
                this.xpraPath = xpraDarwinPath;
                this.sshPath = sshDarwinPath;
                break;

            case 'linux':
                this.xpraPath = xpraUnixPath;
                this.sshPath = sshUnixPath;
                break;

            default:
                throw 'Unknown platform';
        }
    }

    isInstalled() {
        return new Promise((resolve) => {
            Fs.exists(this.xpraPath, resolve);
        });
    }

    startTunnel(conn) {

        return new Promise((resolve, reject) => {

            this.success = false;
            this.authenticating = false;

            const script = `${this.sshPath}`;
            const args = [`-L`, `${conn.localPort}:localhost:${conn.remotePort}`, `${conn.user}@${conn.remoteHost}`];

            // Start SSH tunnel
            this.sshChild = Spawn(script, args);
            var loginWindow = {};

            // Follow stdout to see the output of Plink
            this.sshChild.stdout.on('data', (data) => {

                let url = /Browse to (http:\/\/.+:\d{1,6}) to login/g.exec(data);

                if (url && url.length === 2) {
                    this.authenticating = true;
                    // Accept the notification to trigger the start of the server
                    this.sshChild.stdin.write(`\n`);

                    // Open the page in a new Browser window
                    loginWindow = new BrowserWindow();
                    loginWindow.loadURL(url[1]);
                    return;
                }

                if (/User has been authenticated in eduGAIN network/.test(data) && this.authenticating) {
                    this.authenticating = false;
                    this.success = true;
                    loginWindow.close();
                    console.log(`SSH Tunnel Created at port ${conn.localPort}`);
                    resolve();
                }

            });

            this.sshChild.stderr.on('data', (error) => {

                if (/Store key in cache\? \(y\/n\)/.test(error)) {
                    this.sshChild.stdin.write(`Y`);
                    return;
                }

                if (!this.success) {
                    console.log('Problem logging in the server:' + error);
                    reject();
                }

            });
        });


    }

    startXpra (conn) {

        return new Promise((resolve, reject) => {

            const args = [ `attach`, `tcp:localhost:${conn.localPort}`];

            // Start Xpra Connection
            this.xpraChild = Spawn(this.xpraPath, args);

            // Follow stdout to see the output of xPra
            this.xpraChild.stdout.on('data', (data) => {
                console.log(data.toString());
            });

            this.xpraChild.stderr.on('data', (buffError) => {
                const error = buffError.toString();
                console.log(error);
                let success = `Attached to tcp:localhost:${conn.localPort} \\(press Control-C to detach\\)`;
                if (new RegExp(success).test(error.toString()))
                    resolve();
            });

        });

    }

    disconnect () {

        this.xpraChild.kill();
        this.sshChild.kill();

        this.xpraChild = null;
        this.sshChild = null;

        return Promise.resolve();

    }

}



exports.Connection = Connection;
exports.XpraConnection = XpraConnection;
