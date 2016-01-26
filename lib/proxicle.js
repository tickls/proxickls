/**
 * Created by evan on 16/09/15.
 */


var http        = require('http'),
    httpProxy   = require('http-proxy'),
    argv        = require('optimist').argv,
    debugLog    = argv.debugLog == 'true';

var actionUrlBase = '/proxy/';
var mockResponses = {};


var log = function(str) {
    console.log(str);
};

var debugLog = function(str) {
    if(debugLog) {
        log("[DEBUG]    " + str);
    }
};

var serverLog = function(str) {
    log("[SERVER]   " + str);
};

var proxyLog = function(str) {
    log("[PROXY]    " + str);
};

var error = function(err) {
    log("[ERROR]    " + err);
};

var warning = function(err) {
    log("[WARN]     " + err);
};

var printUsage = function() {
    log("Usage: npm --target=http://teamoranje:5000 --port=5001 (optional)");
};

var writeResponse = function(res, statusCode) {
    statusCode = statusCode || 200;

    res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
    res.end();
};

var handleProxyAction = function(req, res, method, actionUrl) {

    if(method === 'PUT' && actionUrl === 'setMockResponse') {

        var body = '';
        req.on('data', function(chunk) {
            body += chunk;
        });

        req.on('end', function() {
            var bodyData = {};

            try {
                bodyData = JSON.parse(body);

                if(bodyData.body === undefined) {
                    error("Body data needs to be set");
                    return writeResponse(res, 400);
                }

                if(bodyData.url === undefined) {
                    error("Mock URL needs to be set");
                    return writeResponse(res, 400);
                }

                if(mockResponses[bodyData.url] !== undefined) {
                    warning("Mock response already set for url '" + bodyData.url + "', will be overridden with new response");
                }

                var statusCode = bodyData.statusCode || 200;

                serverLog("Setting mock [URL: " + bodyData.url + "] [statusCode: " + statusCode + "] [Response body: " + JSON.stringify(bodyData) + "]");

                mockResponses[bodyData.url] = {
                    statusCode: statusCode,
                    responseBody: bodyData.body
                };

                return writeResponse(res);
            }
            catch(err) {
                error("Could not parse body data: " + err);
                return writeResponse(res, 400);
            }
        });
    }
    else if(method === 'DELETE' && actionUrl === 'clearMockResponse') {
        var bodyData = {};

        var body = '';
        req.on('data', function(chunk) {
            body += chunk;
        });

        req.on('end', function() {
            try {
                bodyData = JSON.parse(body);

                if(bodyData.url === undefined) {
                    error("Mock URL needs to be set");
                    return writeResponse(res, 400);
                }

                if(mockResponses[bodyData.url] === undefined) {
                    warning("Mock response is not set for url '" + bodyData.url + "', skipping clearMockResponse");
                }
                else {
                    serverLog("Clearing mock response for url '" + bodyData.url + "'");
                    delete mockResponses[bodyData.url];
                }

                return writeResponse(res);
            }
            catch(err) {
                error("Could not parse body data: " + err);
                return writeResponse(res, 400);
            }
        });
    }
    else if(method === 'DELETE' && actionUrl === 'clearAllMockResponses') {
        serverLog("Clearing all mock responses");
        mockResponses = {};

        writeResponse(res);
    }
    else {
        error("Did not understand admin action: " + actionUrl + " (Method: " + method + ")");
        writeResponse(res, 400);
    }
};

var handleProxyOverrideRequest = function(req, res) {

    if(req.method.toUpperCase() !== 'PUT' && req.method.toUpperCase() !== 'DELETE') {
        return false;
    }

    if(req.url.indexOf(actionUrlBase) === 0) {
        var actionUrl = req.url.substr(actionUrlBase.length);
        handleProxyAction(req, res, req.method.toUpperCase(), actionUrl);

        return true;
    }

    return false;
};

module.exports = {

    run: function() {
        var target = argv.target;
        var port = argv.port || 5001;

        if(target == undefined) {
            printUsage();
            return;
        }

        serverLog("Creating proxy with target " + target);

        var proxy = httpProxy.createProxyServer({});
        var server = http.createServer(function(req, res) {

            if(!handleProxyOverrideRequest(req, res)) {

                if(mockResponses[req.url] !== undefined) {
                    var mockResponse = mockResponses[req.url];

                    proxyLog("Returning mock data [URL: " + req.url + "] [statusCode: " + mockResponse.statusCode + "] [Response body: " + JSON.stringify(mockResponse.responseBody) + "]");

                    res.writeHead(mockResponse.statusCode, { 'Content-Type': 'application/json' });
                    res.write(JSON.stringify(mockResponse.responseBody, 0, 3));
                    res.end();
                }
                else {
                    proxyLog("Proxying request " + req.url);

                    try {
                        proxy.web(req, res, {
                            target: target
                        });
                    }
                    catch(err) {
                        error("Something went wrong: " + err);
                    }
                }
            }
        });

        serverLog("Listening on port " + port);

        log("  * Mock responses can be set by sending a PUT call to http://localhost:" + port + "/setMockResponse with the following JSON structure as body:");
        log("     {");
        log("         \"url\": \"/the/url/to/override\",");
        log("         \"statusCode\": 500,");
        log("         \"body\": {");
        log("             \"sample\": \"response\"");
        log("         }");
        log("     }");
        log("");
        log("  * Clearing all mock responses can be cleared with sending a DELETE call to http://localhost:" + port + "/clearAllMockResponses");
        log("  * Clearing a specific mock response can be done by sending a DELETE call to http://localhost:" + port + "/clearMockResponse with the following JSON structure as body:");
        log("     {");
        log("         \"url\": \"/the/url/to/override\"");
        log("     }");
        log("");

        server.listen(port);
    }
};