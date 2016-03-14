# proxickls


*WIP*


A lightweight HTTP(S) mock proxy aimed at mocking responses of REST APIs for front-end testing purposes.

## Starting proxickls

``node bin/index --target=http://targethost.com --port=5001 (optional)``

Where ``port`` is the port the proxy server will listen on and ``target`` is the server to which calls that are not mocked will be proxied.


#### Setting a mock response

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
         delay : 2000,
         times: 5
     }

Setting a delay and/or a number of times are both optional! If no delay is given, it defaults to 0. If no number of times is given, it defaults to ∞.

  * Clearing all mock responses can be cleared with sending a DELETE call to http://localhost:5080/proxy/clearAllMockResponses
  * Clearing a specific mock response can be done by sending a DELETE call to http://localhost:5080/proxy/clearMockResponse with the following JSON structure as body:
     {
         "url": "/the/url/to/override"
     }
  * Clearing all delays can be done by sending a DELETE call to http://localhost:5080/proxy/clearDelays

#### Setting multiple delays

Set multiple delays at once. This will also affect existing mock responses!

``/proxy/setMockResponse``

``Method:`` **POST**

Content body

     {
         "delays": [
             {
                "url": "/url",
                "delay": 2000
             },
             {
                "url": "/anotherurl",
                "delay": 5000
             }
          ]
     }


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

``Method:`` **DELETE**

``/proxy/clearProxiedCalls``

