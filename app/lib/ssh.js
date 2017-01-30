const net = require('net');
const SSH2Client = require('ssh2').Client;
const ssh = new SSH2Client();
const co = require('co');
const PortFinder = require('portfinder');

function* createConnection(config) {

    const STATE = {
        HANDSHAKE: 1, // We have to connect and fetch URL from the message
        URL_FETCHED: 2, // We need to check if the user go the access
        AUTHENTICATED: 3 // We are in!
    };

    let URL = "";
    let actualState = STATE.HANDSHAKE;

    return new Promise((resolve, reject) => {
        let sshPromise = new Promise((resolve, reject) => {
            ssh
                .on('ready', function () {
                    console.log('SSH connection ready ...');
                    ssh.removeListener('keyboard-interactive', authenticate);
                    ssh.removeAllListeners('ready');
                    resolve(ssh);
                })
                .on('keyboard-interactive', authenticate)
                .connect({
                    host: config.host,
                    port: 22,
                    username: config.username,
                    //password: config.password,
                    tryKeyboard: true,
                    readyTimeout: 200000,
                });
        });

        function authenticate(name, instructions, instructionsLang, prompts, finish) {
            console.log('Client :: keyboard-interactive');
            switch (actualState) {

                // Grab the URL from the message and open URL
                case STATE.HANDSHAKE:
                    URL = /Browse to (http:\/\/.+:\d{1,6}) to login/g.exec(prompts[0].prompt);

                    if (URL && URL.length === 2) {
                        URL = URL[1];
                        console.log(URL);
                        resolve({
                            url: URL,
                            sshPromise: sshPromise
                        });
                        actualState = STATE.URL_FETCHED;
                        finish(['CONTINUE']);
                    }
                    else {
                        console.log('Client :: ERROR');
                        ssh.removeListener('keyboard-interactive', authenticate);
                        ssh.end();
                        reject();
                        finish(['ERROR']);
                    }
                    break;

                // URL already opened and now we might be allowed access
                case STATE.URL_FETCHED:
                    // TODO If wrong user
                    break;

                // We shouldn't be here
                default:
                    ssh.removeListener('keyboard-interactive', authenticate);
                    console.log(prompts);
                    reject();
                    finish(['ERROR']);

            }
        }
    })
}

function* createTunnel(ssh, config) {

    return new Promise((resolve, reject) => {
        let server = net.createServer(function (sock) {

            let timedOut = false;
            const timeout = setTimeout(() => {
                timedOut = true;
                ssh.end();
                reject(new Error('Timed out while waiting for forwardOut'));
            }, 1000);

            ssh.forwardOut(
                sock.remoteAddress,
                sock.remotePort,
                config.remoteHost,
                config.remotePort,
                function (err, stream) {

                    if (timedOut) {
                        console.log('port forward timed out.');
                        return null;
                    }

                    clearTimeout(timeout);

                    if (err) return sock.end();
                    sock.pipe(stream).pipe(sock);
                    stream.on('close', function () {
                        console.log('TCP :: CLOSED');
                        ssh.end();
                    });
                }
            );

        }).listen(config.localPort, function (test) {
            console.log(`Listening on ${config.localPort} for connections to forward`);
            resolve(server);
        });
    })

}


// ﻿xpra start --bind-tcp=0.0.0.0:14500 --html=on --start-child=firefox
function* setupX11(ssh, config) {

    let xpraCommand = `xpra start --bind-tcp=0.0.0.0:${config.remotePort} --html=on --start-child=${config.xProgram}; bash`;

    return new Promise((resolve, reject) => {

        ssh.exec(xpraCommand, function (err, stream) {
            if (err) reject(err);
            ssh.exec('\x03', function (err, stream) {
                resolve(ssh);
            })
        });

    });

}

function *  getAvailablePort() {
    return new Promise((resolve, reject) => {
        PortFinder.getPort(function (err, port) {
            if (err) reject(err);
            resolve(port);
        });
    });
}

let close = function * close(ssh) {
    return new Promise((resolve, reject) => {
        ssh.exec('xpra exit', function (err, stream) {
            if (err) reject(err);
            try {
                ssh.end();
                resolve(true);
            }
            catch (e) {
                console.log(e);
                reject(e);
            }
        });

    });
};

/* // ssh -L 3306:gilgamesh:80 sturgelose@gilgamesh
 run({
 host: 'helltrain',
 username: 'sturgelose',
 password: 'password',
 localPort: 12345,
 remoteHost: 'helltrain',
 remotePort: 12345,
 xProgram: 'xterm'
 });*/

exports.createConnection = createConnection;
exports.closeConnection = close;
exports.createTunnel = createTunnel;
exports.setupX11 = setupX11;
exports.getAvailablePort = getAvailablePort;
