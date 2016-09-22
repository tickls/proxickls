### *Starting the proxy*

After you have installed [NodeJS](http://www.nodejs.org) and ran `npm install`: 

``node bin/index --target=http://targethost.com --port=5001 (optional)``

Where ``port`` is the port the proxy server will listen on and ``target`` is the server to which calls that are not mocked will be proxied. The ``port`` defaults to ``5001``.

&nbsp;
&nbsp;

##### *Swagger* #####
It is also possible to supply a separate ``swaggerHost`` in case you want the Swagger UI's "try-it-out" feature to work and `localhost`
is not the address at which the server will be available publicly - for instance if your application is deployed on AWS. If you don't supply this parameter, `localhost` is assumed
as a host and the port is either ``5001`` or the value of ``port``.

``node bin/index --target=http://targethost.com --port=5001 --swaggerHost=http://www.anotherhost.com:5002/somePath``

The logs will report where the Swagger endpoint can be reached.

&nbsp;
&nbsp;

### Setting a mock response

``Method:`` **PUT**

``/proxy/setMockResponse``

##### *Content body*

     {
         "url": "/the/url/to/override",
         "statusCode": 500,
         "body": {
             "sample": "response"
         },
         "responseHeaders": {
             "key": "value",
         },
         delay : 2000,
         times: 5
     }

Setting a delay and/or a number of times are both *optional*! If no delay is given, it defaults to 0. If no number of times is given, it defaults to ∞.

&nbsp;
&nbsp;

### Setting multiple delays

``Method:`` **POST**

Set multiple delays at once. This will also affect existing mock responses!

``/proxy/setDelays``

##### *Content body*

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

&nbsp;
&nbsp;

### Clear a specific mock response

``Method:`` **DELETE**

``/proxy/clearMockResponse``

##### *Content body*

     {
         "url": "/the/mock/url/to/remove"
     }

&nbsp;
&nbsp;

### Clear all mock responses

``/proxy/clearAllMockResponses``

``Method:`` **DELETE**

&nbsp;
&nbsp;

### Clear all delays

``Method:`` **DELETE**

Clear all delays. Does *NOT* clear any mock responses however!

``/proxy/clearAllDelays``

&nbsp;
&nbsp;

### List proxied requests

``Method:`` **GET**

Generate a list of all the requests that have been proxied through the proxy server and their responses, if any.

``/proxy/listProxiedRequests?limit=50``

##### **Parameters:**

``limit`` The maximum number of requests, defaults to ∞.

&nbsp;
&nbsp;

### List mock responses

``Method:`` **GET**

Generate a map with all the mock responses that have been set for given URLs. The value in the map for a given key is the number of times that mock response was returned.

``/proxy/listMockResponses``

&nbsp;
&nbsp;

### Clear the list of proxied calls

``Method:`` **DELETE**

``/proxy/clearProxiedCalls``
