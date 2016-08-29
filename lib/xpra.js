'use strict';

const Exec = require('child-process-promise').exec;
const app = require('electron').app;
const Fs = require('fs');
const Promise = require("bluebird");
const PortFinder = Promise.promisifyAll(require('portfinder'));


const xpraDarwinPath = '/Applications/Xpra.app/Contents/MacOS/';
const xpraUnixPath = '';
const xpraWinPath = '';

const sshDarwinPath = 'ssh';
const sshUnixPath = 'ssh';
const sshWinPath = app.getAppPath() + 'lib/plink';

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
                break;

            case 'darwin':
                this.xpraPath = xpraDarwinPath + 'Xpra';
                break;

            case 'linux':
                this.xpraPath = xpraUnixPath + 'Xpra';
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

        const script = `${sshWinPath} -L ${conn.localPort}:localhost:${conn.remotePort} ${conn.user}@${conn.remoteHost}`;
        // Start SSH tunnel

        return Exec (script)
            .then((server) => console.log(server))
            .catch((error) => console.log(error));

    }

}

exports.Xpra = Xpra;
exports.XpraConnection = XpraConnection;
