# proxickls


*WIP*


A lightweight HTTP(S) mock proxy aimed at mocking responses of REST APIs for front-end testing purposes.

## Starting proxickls

``node bin/index --target=http://targethost.com --port=5001 (optional)``

Where ``port`` is the port the proxy server will listen on.


#### Settings a mock response

``/proxy/setMockResponse``

``Method:`` **PUT**

Content body

     {
         "url": "/the/url/to/override",
         "statusCode": 500,
         "body": {
             "sample": "response"
         },
         "responseHeaders": {
             "Authorization": "Bearer ABCDEFABCDEFABCDEFABCDEFABCDEF",
             "X-Proxickls": "Some Mock Response Header"
         },
         delay : 2000
     }

Setting a delay is optional!

  * Clearing all mock responses can be cleared with sending a DELETE call to http://localhost:5080/proxy/clearAllMockResponses
  * Clearing a specific mock response can be done by sending a DELETE call to http://localhost:5080/proxy/clearMockResponse with the following JSON structure as body:
     {
         "url": "/the/url/to/override"
     }
  * Clearing all delays can be done by sending a DELETE call to http://localhost:5080/proxy/clearDelays


#### Clear a specific mock response

``/proxy/clearMockResponse``

``Method:`` **DELETE**

Content body

     {
         "url": "/the/mock/url/to/remove"
     }

#### Clear all mock responses

``/proxy/clearAllMockResponses``

``Method:`` **DELETE**

#### Clear all delays

Clear all delays. Does NOT clear any mock responses however!

``/proxy/clearAllDelays``

``Method:`` **DELETE**

#### List proxied requests

Generate a list of all the requests that have been proxied through the proxy server and their responses (if any)

``/proxy/listProxiedRequests?limit=50``

``Method:`` **GET**

**Parameters:**

``limit`` The maximum number of requests (defaults to unlimited)

#### Clear the list of proxied calls

``/proxy/clearProxiedCalls``

