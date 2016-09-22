var http = require('http'),
  url = require('url'),
  httpProxy = require('http-proxy'),
  argv = require('optimist').argv,
  colors = require('colors'),
  _ = require('lodash'),
  fs = require('fs'),
  path = require('path'),
  enableDebugLog = argv.debugLog == 'true';

var actionUrlBase = '/proxy/';

var mockResponses = {};
var mockResponsesTimesReturnedMap = {};
var responseDelays = {};

var proxiedRequests = [];

const MAX_NO_OF_PROXIES_REQUESTS = 50;

var log = function (str) {
  console.log(str);
};

var debugLog = function (str) {
  if (enableDebugLog) {
    log("  [" + "DEBUG".blue + "]   " + str);
  }
};

var serverLog = function (str) {
  log("[" + "SERVER".green + "]   " + str);
};

var proxyLog = function (str) {
  log(" [" + "PROXY".white + "]   " + str);
};

var error = function (err) {
  log(" [" + "ERROR".red + "]   " + err);
};

var warning = function (err) {
  log("  [" + "WARN".yellow + "]   " + err);
};

var printUsage = function () {
  log("Usage: npm --target=http://targethost.com --port=5001 (optional)");
};

var writeResponse = function (res, statusCode, chunk, headers) {
  statusCode = statusCode || 200;

  res.writeHead(statusCode, Object.assign({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  }, headers));
  if (chunk !== undefined) {
    res.write(chunk);
  }
  res.end();
};

var generateRequestList = function (limit, order) {

  var requestList = [];

  if (proxiedRequests.length == 0) {
    return requestList;
  }

  var count = 0;

  for (var i = proxiedRequests.length - 1; i >= 0 && count++ !== limit; i--) {
    var req = proxiedRequests[i];

    requestList.push(req);
  }

  return requestList;
};

var printHelpUsage = function (port) {

  log("  * Mock responses can be set by sending a PUT call to http://localhost:" + port + "/proxy/setMockResponse with the following JSON structure as body:");
  log("     {");
  log("         \"url\": \"/the/url/to/override\",");
  log("         \"statusCode\": 500,");
  log("         \"body\": {");
  log("             \"sample\": \"response\"");
  log("         },");
  log("         \"responseHeaders\": {");
  log("             \"sample\": \"response\"");
  log("         },");
  log("         \"delay\": 500, (OPTIONAL -> defaults to 0)");
  log("         \"times\": 5 (OPTIONAL -> defaults to ∞)");
  log("     }");
  log("");
  log("  * Clearing all mock responses can be cleared with sending a DELETE call to http://localhost:" + port + "/proxy/clearAllMockResponses");
  log("  * Clearing a specific mock response can be done by sending a DELETE call to http://localhost:" + port + "/proxy/clearMockResponse with the following JSON structure as body:");
  log("     {");
  log("         \"url\": \"/the/url/to/override\"");
  log("     }");
  log("");
};

var handleProxyAction = function (req, res, method, requestUrl) {

  var urlParts = url.parse(requestUrl, true);
  var actionUrl = urlParts.pathname;

  if (method === 'PUT' && actionUrl === 'setMockResponse') {

    var body = '';
    req.on('data', function (chunk) {
      body += chunk;
    });

    req.on('end', function () {
      var bodyData = {};

      try {
        bodyData = JSON.parse(body);

        if (bodyData.body === undefined) {
          error("Body data needs to be set");
          return writeResponse(res, 400);
        }

        if (bodyData.url === undefined) {
          error("Mock URL needs to be set");
          return writeResponse(res, 400);
        }

        mockResponsesTimesReturnedMap[bodyData.url] = 0;

        if (mockResponses[bodyData.url] !== undefined) {
          warning("Mock response already set for url '" + bodyData.url + "', will be overridden with new response");
        } else if (responseDelays[bodyData.url] !== undefined) {
          warning("Response delay already set for url '" + bodyData.url + "' (" + responseDelays[bodyData.url].delay + " ms), will be overridden.");
        }

        var statusCode = bodyData.statusCode || 200;

        serverLog("Setting mock [URL: " + bodyData.url + "] " +
          "[Status code: " + statusCode + "] " +
          (bodyData.body === Object(bodyData.body) ? "[Response body: " + JSON.stringify(bodyData.body) + "] " : "[Raw response body (body was primitive type)]: " + bodyData.body + "] ") +
          "[Delay: " + (bodyData.delay !== undefined ? bodyData.delay : 0) + " ms]" +
          "[Times: " + (bodyData.times !== undefined ? bodyData.times : "∞") + "]");

        mockResponses[bodyData.url] = {
          statusCode: statusCode,
          responseBody: bodyData.body,
          responseHeaders: bodyData.responseHeaders,
          times: bodyData.times
        };

        responseDelays[bodyData.url] = {
          delay: bodyData.delay || 0
        };

        return writeResponse(res);
      }
      catch (err) {
        error("Could not parse body data: " + err);
        return writeResponse(res, 400);
      }
    });
  }
  else if (method === 'DELETE' && actionUrl === 'clearMockResponse') {
    var bodyData = {};

    var body = '';
    req.on('data', function (chunk) {
      body += chunk;
    });

    req.on('end', function () {
      try {
        bodyData = JSON.parse(body);

        if (bodyData.url === undefined) {
          error("Mock URL needs to be set");
          return writeResponse(res, 400);
        }

        if (mockResponses[bodyData.url] === undefined) {
          warning("Mock response is not set for url '" + bodyData.url + "', skipping clearMockResponse");
        }
        else {
          serverLog("Clearing mock response for url '" + bodyData.url + "'");
          delete mockResponses[bodyData.url];
          delete mockResponsesTimesReturnedMap[bodyData.url];
          delete responseDelays[bodyData.url];
        }

        return writeResponse(res);
      }
      catch (err) {
        error("Could not parse body data: " + err);
        return writeResponse(res, 400);
      }
    });
  }
  else if (method === 'DELETE' && actionUrl === 'clearProxiedCalls') {
    proxiedRequests = [];

    writeResponse(res);
  }
  else if (method === 'DELETE' && actionUrl === 'clearAllMockResponses') {
    serverLog("Clearing all mock responses");
    mockResponses = {};
    mockResponsesTimesReturnedMap = {};

    writeResponse(res);
  }
  else if (method === 'DELETE' && actionUrl === 'clearAllDelays') {
    serverLog("Clearing all delays");
    responseDelays = {};

    writeResponse(res);
  }
  else if (method === 'GET' && actionUrl === 'listMockResponses') {
    writeResponse(res, 200, JSON.stringify(mockResponsesTimesReturnedMap, null, 4));
  }
  else if (method === 'GET' && actionUrl === 'listProxiedRequests') {
    var limit = parseInt((urlParts.query['limit'] || -1));
    var requestList = generateRequestList(limit, 'asc');

    writeResponse(res, 200, JSON.stringify(requestList, null, 4));
  } else if (method === 'GET' && actionUrl === 'swagger') {

    //Put the port that was given as a command line argument into the swagger spec.
    var jsonBody = JSON.parse(fs.readFileSync('./swagger/swagger.json', 'utf-8'));

    argv.swaggerHost !== undefined ? swaggerHost = argv.swaggerHost : swaggerHost = "localhost" + ":" + port;

    jsonBody.host = swaggerHost;

    writeResponse(res, 200, JSON.stringify(jsonBody, null, 4));
  }
  else if (method === 'POST' && actionUrl === 'setDelays') {

    var body = '';
    req.on('data', function (chunk) {
      body += chunk;
    });

    req.on('end', function () {
      var bodyData = {};

      try {
        bodyData = JSON.parse(body);

        if (bodyData.delays === undefined) {
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
      catch (err) {
        error("Could not parse body data: " + err);
        return writeResponse(res, 400);
      }
    });
  }
  else if (method === 'OPTIONS') {
    writeResponse(res, 200, undefined, {'Allow': 'GET, POST, PUT, DELETE, OPTIONS'});
  }
  else {
    error("Did not understand admin action: " + actionUrl + " (Method: " + method + ")");
    writeResponse(res, 400);
  }
};

var handleProxyOverrideRequest = function (req, res) {

  if (req.url.indexOf(actionUrlBase) === 0) {
    handleProxyAction(req, res, req.method.toUpperCase(), req.url.substr(actionUrlBase.length));

    return true;
  }

  return false;
};

module.exports = {

  run: function () {
    var target = argv.target;
    port = argv.port || 5001;

    if (target == undefined) {
      printUsage();
      printHelpUsage(port);
      return;
    }

    var secureTarget = (target.indexOf('https://') == 0);

    var urlParts = url.parse(target);

    serverLog("Creating proxy with target " + target.white + " (HTTPS: " + (secureTarget ? colors.white(secureTarget) : colors.red(secureTarget)) + ")");

    var proxy = httpProxy.createProxyServer({
      secure: false
    });

    proxy.on('error', function (err) {
      error("Proxy error: " + err);
    });

    proxy.on('proxyRes', function (proxyRes, req, res) {
      var res = proxiedRequests[req.id].res;
      res.headers = proxyRes.headers;
      res.date = new Date();
    });

    var server = http.createServer(function (req, res) {

      if (!handleProxyOverrideRequest(req, res)) {

        var urlBasePath = url.parse(req.url).pathname;

        if (mockResponses[req.url] !== undefined || mockResponses[urlBasePath] !== undefined) {
          var mockResponse;
          var url_;

          // If the full URL (including query parameters) corresponds to a mock response, use that. Otherwise,
          // use the mock response set for the base path.
          if (mockResponses[req.url] !== undefined) {
            mockResponse = mockResponses[req.url];
            url_ = req.url;
          } else if (mockResponses[urlBasePath] !== undefined) {
            mockResponse = mockResponses[urlBasePath];
            url_ = urlBasePath;
          }

          proxyLog("Returning mock data [URL: " + url_ + "] [statusCode: " + mockResponse.statusCode + "] " +
            (mockResponse.responseBody === Object(mockResponse.responseBody) ? "[Response body: " + JSON.stringify(mockResponse.responseBody) + "] " : "[Raw response body (body was primitive type)]: " + mockResponse.responseBody + "] ") +
            "[Delay: " + (responseDelays[url_] !== undefined ? responseDelays[url_].delay : 0) + "ms]" +
            "[Times: " + (mockResponse.times !== undefined ? mockResponse.times - 1 : "∞") + " left]");

          setTimeout(function () {
            var responseHeaders = {'Content-Type': 'application/json'};

            if (mockResponse.responseHeaders !== undefined) {
              _.extend(responseHeaders, mockResponse.responseHeaders);
            }

            res.writeHead(mockResponse.statusCode, responseHeaders);
            mockResponse.responseBody === Object(mockResponse.responseBody) ? res.write(JSON.stringify(mockResponse.responseBody, null, 4)) : res.write(mockResponse.responseBody.toString(), null, 4);
            res.end();

            mockResponsesTimesReturnedMap[req.url]++;

            if (mockResponse.times !== undefined && --mockResponse.times <= 0) {
              mockResponses[url_] = undefined;
              mockResponsesTimesReturnedMap[url_] = undefined;
              responseDelays[url_] = undefined;
            }

          }, responseDelays[url_] !== undefined ? responseDelays[url_].delay : 0);

        }
        else {
          proxyLog("Proxying request " + req.url);

          try {

            req.id = proxiedRequests.length;

            proxiedRequests.push({
              req: {
                date: new Date(),
                url: req.url,
                headers: req.headers,
                method: req.method
              }, res: {}
            });

            if (proxiedRequests.length > MAX_NO_OF_PROXIES_REQUESTS) {
              proxiedRequests.shift();
              req.id--;
            }

            if (secureTarget) {
              req.headers['host'] = urlParts.host;
            }

            var proxy_web = function () {
              proxy.web(req, res, {
                target: target
              });
            };

            if (responseDelays[req.url] !== undefined) {
              proxyLog("Delaying call by " + responseDelays[req.url].delay + " milliseconds.");
              setTimeout(proxy_web, responseDelays[req.url].delay);
            } else {
              proxy_web();
            }
          }
          catch (err) {
            error("Something went wrong while proxying request: " + req.url + " Error: " + err);
          }
        }
      }
    });

    serverLog("Listening on port " + colors.white("" + port));

    argv.swaggerHost !== undefined ? swaggerHost = argv.swaggerHost : swaggerHost = "http://localhost" + ":" + port;

    serverLog("Swagger spec available at " + colors.white(swaggerHost + actionUrlBase + "swagger"));

    serverLog("Public Swagger UI available at " + colors.white("http://petstore.swagger.io/index.html?url=" + swaggerHost + actionUrlBase + "swagger"));

    serverLog("If you are behind a firewall, we recommend using Localtunnel: " + colors.red("https://localtunnel.github.io/www/"));

    server.listen(port);
  }
};
