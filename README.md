express-brute
=============
[![Build Status](https://travis-ci.org/AdamPflug/express-brute.png?branch=master)](https://travis-ci.org/AdamPflug/express-brute)
[![NPM version](https://badge.fury.io/js/express-brute.png)](http://badge.fury.io/js/express-brute)

A brute-force protection middleware for express routes that rate limits incoming requests, increaseing the delay with each request in a fibonacci-like sequence.

Installation
------------
  via npm:

      $ npm install express-brute

A Simple Example
----------------
``` js
var ExpressBrute = require('express-brute'),

var store = new ExpressBrute.MemoryStore(); // stores state locally, don't use this in production
var bruteforce = new ExpressBrute(store);

app.post('/auth',
	bruteforce.prevent, // error 403 if we hit this route too often
	function (req, res, next) {
		res.send('Success!');
	}
);
```

Options
-------
### ExpressBrute(store, options)
- `store` An instance of `ExpressBrute.MemoryStore` or `ExpressBrute.MemcachedStore`
- `options`
	- `freeRetries`  The number of retires the user has before they need to start waiting (default: 2)
	- `minWait`      The initial wait time (in milliseconds) after the user runs out of retries (default: 500 milliseconds)
	- `maxWait`      The maximum amount of time (in milliseconds) between requests the user needs to wait (default: 15 minutes). The wait for a given request is determined by adding the time the user needed to wait for the previous two requests.
	- `lifetime`     The length of time (in seconds since the last request) to remember the number of requests that have been made by an IP. By default it will be set to `maxWait * the number of attempts before you hit maxWait` to discourage simply waiting for the lifetime to expire before resuming an attack. With default values this is about 6 hours.
	- `failCallback` gets called with (`req`, `resp`, `next`, `nextValidRequestDate`) when a request is rejected (default: ExpressBrute.FailForbidden)

### ExpressBrute.MemcachedStore(hosts, options)
- `hosts` Memcached servers locations, can by string, array, or hash.
- `options`
	- `prefix`       An optional prefix for each memcache key, in case you are sharing 
	                 your memcached servers with something generating its own keys.
	- ...            The rest of the options will be passed directly to the node-memcached constructor.

For details see [node-memcached](http://github.com/3rd-Eden/node-memcached).

Instance Methods
----------------
- `protect(req, res, next)` Middleware that will bounce requests that happen faster than
                            the current wait time by calling `failCallback`
- `reset(req, callback)`    Resets the wait time between requests back to its initial value.
                            For example, if you are protecting a login route you probably want to 
                            call this on successful login, otherwise other users trying to log in 
                            from that ip will experience more aggressive request throttling than 
                            they should.


Built-in failure callbacks
---------------------------
There are some built-in callbacks that come with BruteExpress that handle some common use cases.
		- `ExpressBrute.FailForbidden` Terminates the request and responds with a 403 and json error message
		- `ExpressBrute.FailMark` Sets res.nextValidRequestDate and the res.status=403, then calls next() to pass the request on to the appropriate routes
