'use strict';

window.$ = window.jQuery = require('jquery');
const {ipcRenderer} = require('electron')
const remote = require('electron').remote;


const ValidIpAddressRegex = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/;
const ValidHostnameRegex = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/;

// Bind function to submit event of form using JQuery
$('#cy-local-login').submit(function () {

    let usernameTag = $("input#username");
    let serverTag = $("input#server");
    let portTag = $("input#port");

    let username = usernameTag.val();
    let server = serverTag.val();
    let port = portTag.val();

    let valid = true;

    // Validate username
    if (/[a-z_][a-z0-9_]{0,30}/.test(username))
        usernameTag.closest("div.form-group").removeClass('has-error');
    else {
        valid = false;
        usernameTag.closest("div.form-group").addClass('has-error');
    }


    // Validate server
    if (ValidHostnameRegex.test(server) || ValidIpAddressRegex.test(server))
        serverTag.closest("div.form-group").removeClass('has-error');
    else
    {
        valid = false;
        serverTag.closest("div.form-group").addClass('has-error');
    }


    // Validate port
    if (port !== "" && !isNaN(port))
        portTag.closest("div.form-group").removeClass('has-error');
    else {
        valid = false;
        portTag.closest("div.form-group").addClass('has-error');
    }


    // Start connection if everything is valid
    if (valid) {
        ipcRenderer.send('successful-login', {
            username: username,
            server: server,
            port: port
        });

        // var window = remote.getCurrentWindow();
        // window.close();
    }

    return false;

});