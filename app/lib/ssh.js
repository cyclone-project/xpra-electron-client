const net = require('net');
const SSH2Client = require('ssh2').Client;
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

        let ssh = new SSH2Client();
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

function forwardConnection(ssh, config) {

    return new Promise((resolve, reject) => {
        let timedOut = false;
        const timeout = setTimeout(() => {
            timedOut = true;
            ssh.end();
            reject(new Error('Timed out while waiting for forwardOut'));
        }, 10000);

        ssh.forwardOut(
            '127.0.0.1',
            config.localPort,
            '127.0.0.1',
            config.remotePort,
            (err, stream) => {
                if (timedOut) {
                    console.log('port forward timed out.');
                    return null;
                }

                clearTimeout(timeout);

                if (err) {
                    ssh.end();
                    return reject(err);
                }

                console.log('port forward stream is ready.');
                stream.on('close', () => {
                    //console.log('port forward stream is closed.');
                });

                resolve(stream);
            }
        );
    });

}

function * createTunnel (ssh, config) {

    //yield forwardConnection(ssh, config);

    return new Promise( (resolve, reject) => {
        const server = net.createServer( co.wrap(function * (connection) {
            const stream = yield forwardConnection(ssh, config);
            connection.pipe(stream).pipe(connection);
            //console.log('tunnel pipeline created.');
        }));
        server.on('error', err => {
            reject(err);
            ssh.end();
        });
        server.on('close', () => ssh.end());
        server.listen(config.localPort, 'localhost', () => {
            //console.log('local tcp server listening.');
            resolve(server);
        });
    });
}

function *  getAvailablePort() {
    return new Promise((resolve, reject) => {
        PortFinder.getPort(function (err, port) {
            if (err) reject(err);
            resolve((port + 1).toString());
        });
    });
}

let close = function * close(ssh) {
    return new Promise((resolve, reject) => {
        resolve(true);
        ssh.end();

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
exports.getAvailablePort = getAvailablePort;
