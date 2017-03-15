'use strict';

require('electron-cookies');

window.$ = window.jQuery = require('jquery');
const {ipcRenderer} = require('electron');
const remote = require('electron').remote;


const ValidIpAddressRegex = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/;
const ValidHostnameRegex = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/;

let connectionRunning = false;

ipcRenderer.on('connection-started', function () {
    connectionRunning = true;
    $('#cy-local-login').find('div div :input:not(:button)').prop('disabled', true);
    $('#cy-login').val('Disconnect');
});

ipcRenderer.on('connection-ended', function () {
    connectionRunning = false;
    $('#cy-local-login').find('div div :input:not(:button)').prop('disabled', false);
    $('#cy-login').val('Log in');
});

// Bind function to submit event of form using JQuery
$('#cy-local-login').submit(function () {

    if (connectionRunning) {
        ipcRenderer.send('disconnect');
        return false;
    }

    let usernameTag = $("input#username");
    let serverTag = $("input#server");
    let remotePortTag = $("input#remotePort");
    let localPortTag = $("input#localPort");

    let username = usernameTag.val();
    let server = serverTag.val();
    let remotePort = remotePortTag.val();
    let localPort = localPortTag.val();

    let selectedForm = $('#form-selector').val();

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


    // Validate local port if needed
    if (selectedForm === 'sshTunnel') {

        // Validate local port
        if (localPort !== "" && !isNaN(localPort))
            localPortTag.closest("div.form-group").removeClass('has-error');
        else {
            valid = false;
            localPortTag.closest("div.form-group").addClass('has-error');
        }

    }

    // Validate remote port if needed
    if (selectedForm === 'sshTunnel') {

        // Validate remote port
        if (remotePort !== "" && !isNaN(remotePort))
            remotePortTag.closest("div.form-group").removeClass('has-error');
        else {
            valid = false;
            remotePortTag.closest("div.form-group").addClass('has-error');
        }

    }

    // Start connection if everything is valid
    if (valid) {
        ipcRenderer.send('successful-login', {
            selectedForm: selectedForm,
            username: username,
            server: server,
            localPort: localPort,
            remotePort: remotePort
        });

        // Close the login window as we don't need it anymore
        remote.getCurrentWindow().hide();
    }

    return false;

});

$(function () {
    $('#form-selector').change(function () {
        $('.hiddable').hide();
        $('.' + $(this).val()).show();
    })
});

$('.selected-form').hide();
$('#sshTunnel').show();
