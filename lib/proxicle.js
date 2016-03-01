/**
 * Created by evan on 16/09/15.
 */


var http            = require('http'),
    url             = require('url'),
    httpProxy       = require('http-proxy'),
    argv            = require('optimist').argv,
    colors          = require('colors'),
    _               = require('lodash'),
    fs              = require('fs'),
    path            = require('path'),
    enableDebugLog  = argv.debugLog == 'true';


var actionUrlBase = '/proxy/';
var mockResponses = {};

var responseDelays = {};

var proxiedRequests = [];


var log = function(str) {
    console.log(str);
};

var debugLog = function(str) {
    if(enableDebugLog) {
        log("  [" + "DEBUG".blue + "]   " + str);
    }
};

var serverLog = function(str) {
    log("[" + "SERVER".green + "]   " + str);
};

var proxyLog = function(str) {
    log(" [" + "PROXY".white + "]   " + str);
};

var error = function(err) {
    log(" [" + "ERROR".red + "]   " + err);
};

var warning = function(err) {
    log("  [" + "WARN".yellow + "]   " + err);
};

var printUsage = function() {
    log("Usage: npm --target=http://teamoranje:5000 --port=5001 (optional)");
};

var writeResponse = function(res, statusCode) {
    statusCode = statusCode || 200;

    res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
    res.end();
};

var generateRequestList = function(limit, order) {

    var requestList = [];

    if(proxiedRequests.length == 0) {
        return requestList;
    }

    var count = 0;

    for(var i = proxiedRequests.length - 1; i >= 0 && count++ !== limit; i--) {
        var req = proxiedRequests[i];

        requestList.push(req);
    }

    return requestList;
};

var printHelpUsage = function(port) {

    log("  * Mock responses can be set by sending a PUT call to http://localhost:" + port + "/setMockResponse with the following JSON structure as body:");
    log("     {");
    log("         \"url\": \"/the/url/to/override\",");
    log("         \"statusCode\": 500,");
    log("         \"body\": {");
    log("             \"sample\": \"response\"");
    log("         },");
    log("         \"responseHeaders\": {");
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
};

var handleProxyAction = function(req, res, method, requestUrl) {


    var urlParts = url.parse(requestUrl, true);
    var actionUrl = urlParts.pathname;

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
                    responseBody: bodyData.body,
                    responseHeaders: bodyData.responseHeaders
                };

                if (responseDelays[bodyData.url] !== undefined) {
                    warning ("Response delay already set for url '" + bodyData.url +"' (" + responseDelays[bodyData.url].delay + " ms), will be overridden.");
                }

                responseDelays[bodyData.url] = {
                    delay: bodyData.delay
                }

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
    else if(method === 'DELETE' && actionUrl === 'clearProxiedCalls') {
        proxiedRequests = [];

        writeResponse(res);
    }
    else if(method === 'DELETE' && actionUrl === 'clearAllMockResponses') {
        serverLog("Clearing all mock responses");
        mockResponses = {};

        writeResponse(res);
    }
    else if(method === 'DELETE' && actionUrl === 'clearAllDelays') {
        serverLog("Clearing all delays");
        responseDelays = {};

        writeResponse(res);
    }
    else if(method === 'GET' && actionUrl === 'listProxiedRequests') {
        var limit = parseInt((urlParts.query['limit'] || -1));
        var requestList = generateRequestList(limit, 'asc');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.write(JSON.stringify(requestList, 0, 3));
        res.end();
    }
    else if (method === 'POST' && actionUrl === 'setDelays') {

        var body = '';
        req.on('data', function(chunk) {
            body += chunk;
        });

        req.on('end', function() {
            var bodyData = {};

            try {
                bodyData = JSON.parse(body);

                if(bodyData.delays === undefined) {
                    error("Delay data needs to be set");
                    return writeResponse(res, 400);
                }

                for (var i = 0; i < bodyData.delays.length; i++) {
                    serverLog("Setting delay of " + bodyData.delays[i].delay + " milliseconds for URL: " + bodyData.delays[i].url);
                    responseDelays[bodyData.delays[i].url] = {
                        delay: bodyData.delays[i].delay
                    }
                }

                return writeResponse(res);
            }
            catch(err) {
                error("Could not parse body data: " + err);
                return writeResponse(res, 400);
            }
        });
    }
    else {
        error("Did not understand admin action: " + actionUrl + " (Method: " + method + ")");
        writeResponse(res, 400);
    }
};

var handleProxyOverrideRequest = function(req, res) {

    //if(req.method.toUpperCase() !== 'PUT' && req.method.toUpperCase() !== 'DELETE') {
    //    return false;
    //}

    if(req.url.indexOf(actionUrlBase) === 0) {
        handleProxyAction(req, res, req.method.toUpperCase(), req.url.substr(actionUrlBase.length));

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
            printHelpUsage(5080);
            return;
        }

        var secureTarget = (target.indexOf('https://') == 0);

        var urlParts = url.parse(target);

        serverLog("Creating proxy with target " + target.white + " (Secure: " + secureTarget + ")");

        var proxy = httpProxy.createProxyServer({
            //secure: secureTarget
        });

        proxy.on('error', function(err) {
            error("Proxy error: " + err + "\n" + err.stack);
        });

        var server = http.createServer(function(req, res) {

            if(!handleProxyOverrideRequest(req, res)) {

                if(mockResponses[req.url] !== undefined) {
                    var mockResponse = mockResponses[req.url];

                    proxyLog("Returning mock data [URL: " + req.url + "] [statusCode: " + mockResponse.statusCode + "] [Response body: " + JSON.stringify(mockResponse.responseBody) + "]");

                    var responseHeaders = { 'Content-Type': 'application/json' };

                    if(mockResponse.responseHeaders !== undefined) {
                        _.extend(responseHeaders, mockResponse.responseHeaders);
                    }

                    var write_response = function() {
                        res.writeHead(mockResponse.statusCode, responseHeaders);
                        res.write(JSON.stringify(mockResponse.responseBody, 0, 3));
                        res.end();
                    }

                    if (responseDelays[req.url] !== undefined) {
                        proxyLog("Delaying call by " + responseDelays[req.url].delay + " milliseconds.");
                        setTimeout(write_response, responseDelays[req.url].delay);

                    } else {
                        write_response();
                    }
                }
                else {
                    proxyLog("Proxying request " + req.url);

                    try {
                        proxiedRequests.push({
                            date:       new Date(),
                            url:        req.url,
                            headers:    req.headers,
                            method:     req.method//,
                        });

                        if(secureTarget) {
                            req.headers['host'] = urlParts.host;
                        }

                        var proxy_web = function() {
                            proxy.web(req, res, {
                                target: target
                            });
                        }

                        if (responseDelays[req.url] !== undefined) {
                            proxyLog("Delaying call by " + responseDelays[req.url].delay + " milliseconds.");
                            setTimeout(proxy_web, responseDelays[req.url].delay);
                        } else {
                            proxy_web();
                        }
                    }
                    catch(err) {
                        error("Something went wrong while proxying request: " + req.url + " Error: " + err);
                    }
                }
            }
        });

        serverLog("Listening on port " + colors.white("" + port));


        server.listen(port);
    }
};