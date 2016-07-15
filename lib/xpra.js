'use strict';

const Exec = require('child-process-promise').exec;
const Suppose = require('suppose');
const Sh = require('sh');
const Fs = require('fs');
const Promise = require("bluebird");
const Tunnel = Promise.promisify(require('tunnel-ssh'));
const PortFinder = Promise.promisifyAll(require('portfinder'));


const darwinPath = '/Applications/Xpra.app/Contents/MacOS/';
const unixPath = '';
const winPath = '';

class XpraConnection {

    constructor(user, remoteHost, password, screenNumber) {
        this.user = user;
        this.remoteHost = remoteHost;
        this.screenNumber = (typeof screenNumber === 'undefined') ? 1 : screenNumber;
        this.password = password;
    }

    init() {
        return PortFinder.getPortAsync()
            .then((result) => {
                this.localPort = result;
                return this;
            });
    }

    tunnelConfig() {
        return {
            user: this.user,
            host: this.remoteHost,
            port: '22',
            dstHost: this.remoteHost,
            dstPort: 22,
            localHost: '127.0.0.1',
            localPort: this.localPort,
            password: this.password
        };
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
                this.path = winPath + 'Xpra';
                break;

            case 'darwin':
                this.path = darwinPath + 'Xpra';
                break;

            case 'linux':
                this.path = unixPath + 'Xpra';
                break;

            default:
            //TODO throw error
        }
    }

    isInstalled() {
        return new Promise((resolve) => {
            Fs.exists(this.path, resolve);
        });
    }

    start(connection) {

        let xpra = this;
        const script = xpra.path;
        const args = `ssh:${connection.user}@$'localhost':${connection.screenNumber}`;
        // Start SSH tunnel

        return Exec (script + ` --ssh="ssh -p ${connection.localPort} -tt -X" attach `+ args)
            .then((server) => console.log(server))
            .catch((error) => console.log(error));

        return Tunnel(connection.tunnelConfig())
            .then((tunnel) => console.log(tunnel))
            .catch((error) => console.log(error));

    }

    close() {
        return new Promise((resolve) => {
            this.childProcess.disconnect(resolve);
        });
    }

}

exports.Xpra = Xpra;
exports.XpraConnection = XpraConnection;
