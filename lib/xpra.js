'use strict';

const Exec = require('child_process').exec;
const app = require('electron').app;
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

        const script = `${this.sshPath} -L ${conn.localPort}:localhost:${conn.remotePort} ${conn.user}@${conn.remoteHost}`;

        // Start SSH tunnel
        var child = Exec (script);

        // Follow stdout to see the output of Plink
        child.stdout.on('data', (data) => {
            if (data === `${conn.user}@${conn.remoteHost}'s password: `) {
                child.stdin.write(`${conn.password}\n`);
                return;
            }
            if (data === `\r\n`)
                return;
            this.success = true;
            console.log('SSH Tunnel Created');
            // TODO check that the password it's not wrong
        });

        child.stderr.on('data', (data) => {
            if (!this.success)
                console.log('Problem logging in the server')
        });
    }

}

exports.Xpra = Xpra;
exports.XpraConnection = XpraConnection;
