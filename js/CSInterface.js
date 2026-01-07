/**
 * CSInterface - Adobe CEP Communication Library
 * Minimal version for OpenSway
 */

function CSInterface() {}

CSInterface.prototype.evalScript = function(script, callback) {
    if (callback === null || callback === undefined) {
        callback = function() {};
    }
    window.__adobe_cep__.evalScript(script, callback);
};

CSInterface.prototype.getHostEnvironment = function() {
    var env = window.__adobe_cep__.getHostEnvironment();
    return JSON.parse(env);
};

CSInterface.prototype.getSystemPath = function(pathType) {
    return window.__adobe_cep__.getSystemPath(pathType);
};

CSInterface.prototype.addEventListener = function(type, listener, obj) {
    window.__adobe_cep__.addEventListener(type, listener, obj);
};

CSInterface.prototype.removeEventListener = function(type, listener, obj) {
    window.__adobe_cep__.removeEventListener(type, listener, obj);
};

CSInterface.prototype.requestOpenExtension = function(extensionId, params) {
    window.__adobe_cep__.requestOpenExtension(extensionId, params);
};

CSInterface.prototype.closeExtension = function() {
    window.__adobe_cep__.closeExtension();
};

CSInterface.prototype.getExtensionID = function() {
    return window.__adobe_cep__.getExtensionId();
};

// System path constants
CSInterface.EXTENSION_PATH = "extension";
CSInterface.USER_DATA = "userData";
CSInterface.COMMON_FILES = "commonFiles";
CSInterface.HOST_APPLICATION = "hostApplication";
