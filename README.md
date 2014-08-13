express-brute
=============
[![Build Status](https://travis-ci.org/AdamPflug/express-brute.png?branch=master)](https://travis-ci.org/AdamPflug/express-brute)
[![NPM version](https://badge.fury.io/js/express-brute.png)](http://badge.fury.io/js/express-brute)

A brute-force protection middleware for express routes that rate-limits incoming requests, increasing the delay with each request in a fibonacci-like sequence.

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
	bruteforce.prevent, // error 429 if we hit this route too often
	function (req, res, next) {
		res.send('Success!');
	}
);
```

Classes
-------
### ExpressBrute(store, options)
- `store` An instance of `ExpressBrute.MemoryStore` or some other ExpressBrute store (see a list of known stores below).
- `options`
	- `freeRetries`             The number of retires the user has before they need to start waiting (default: 2)
	- `minWait`                 The initial wait time (in milliseconds) after the user runs out of retries (default: 500 milliseconds)
	- `maxWait`                 The maximum amount of time (in milliseconds) between requests the user needs to wait (default: 15 minutes). The wait for a given request is determined by adding the time the user needed to wait for the previous two requests.
	- `lifetime`                The length of time (in seconds since the last request) to remember the number of requests that have been made by an IP. By default it will be set to `maxWait * the number of attempts before you hit maxWait` to discourage simply waiting for the lifetime to expire before resuming an attack. With default values this is about 6 hours.
	- `failCallback` gets called with (`req`, `resp`, `next`, `nextValidRequestDate`) when a request is rejected (default: ExpressBrute.FailForbidden)
	- `proxyDepth`              Specifies how many levels of the `X-Forwarded-For` header to trust. If your web server is behind a CDN and/or load balancer you'll need to set this to however many levels of proxying it's behind to get a valid IP. Setting this too high allows attackers to get around brute force protection by spoofing the `X-Forwarded-For` header, so don't set it higher than you need to (default: 0)
	- `attachResetToRequest`    Specify whether or not a simplified reset method should be attached at `req.brute.reset`. The simplified method takes only a callback, and resets all `ExpressBrute` middleware that was called on the current request. If multiple instances of `ExpressBrute` have middleware on the same request, only those with `attachResetToRequest` set to true will be reset (default: true)
	- `refreshTimeoutOnRequest` Defines whether the remaining `lifetime` of a counter should be based on the time since the last request (true) of the time since the first request (false). Useful for allowing limits over fixed periods of time, for example a limited number of requests per day. (Default: true)

### ExpressBrute.MemoryStore()
An in-memory store for persisting request counts. Don't use this in production, instead choose one of the more robust store implementations listed below.


`ExpressBrute` Instance Methods
-------------------------------
- `prevent(req, res, next)` Middleware that will bounce requests that happen faster than
                            the current wait time by calling `failCallback`. Equivilent to `getMiddleware(null)`
- `getMiddleware(options)`  Generates middleware that will bounce requests with the same `key` and IP address
                            that happen faster than the current wait time by calling `failCallback`.
                            Also attaches a function at `req.brute.reset` that can be called to reset the
                            counter for the current ip and key. This functions the the `reset` instance method,
                            but without the need to explicitly pass the `ip` and `key` paramters
	- `key`           can be a string or alternatively it can be a `function(req, res, next)`
	                  that or calls `next`, passing a string as the first parameter.
	- `failCallback`  Allows you to override the value of `failCallback` for this middleware
- `reset(ip, key, next)`    Resets the wait time between requests back to its initial value. You can pass `null`
                            for `key` if you want to reset a request protected by `protect`.
- `getIPFromRequest(req)`   Uses the current proxy trust settings to get the current IP from a request object

Built-in Failure Callbacks
---------------------------
There are some built-in callbacks that come with BruteExpress that handle some common use cases.
- `ExpressBrute.FailTooManyRquests` Terminates the request and responses with a 429 (Too Many Requests) error that has a `Retry-After` header and a JSON error message.
- `ExpressBrute.FailForbidden` Terminates the request and responds with a 403 (Forbidden) error that has a `Retry-After` header and a JSON error message. This is provided for compatibility with ExpressBrute versions prior to v0.5.0, for new users `FailTooManyRequests` is the preferred behavior.
- `ExpressBrute.FailMark` Sets res.nextValidRequestDate, the Retry-After header and the res.status=429, then calls next() to pass the request on to the appropriate routes.

`ExpressBrute` stores
---------------------
There are a number adapters that have been written to allow ExpressBrute to be used with different persistant storage implementations, some of the ones I know about include:
- [Memcached](https://github.com/AdamPflug/express-brute-memcached)
- [Redis](https://github.com/AdamPflug/express-brute-redis)
- [MongoDB](https://github.com/auth0/express-brute-mongo)

A More Complex Example
----------------------
``` js
require('connect-flash');
var ExpressBrute = require('express-brute'),
	MemcachedStore = require('express-brute-memcached'),
	moment = require('moment'),
    store;

if (config.environment == 'development'){
	store = new ExpressBrute.MemoryStore(); // stores state locally, don't use this in production
} else {
	// stores state with memcached
	store = new MemcachedStore(['127.0.0.1'], {
		prefix: 'NoConflicts'
	});
}

var failCallback = function (req, res, next, nextValidRequestDate) {
	req.flash('error', "You've made too many failed attempts in a short period of time, please try again "+moment(nextValidRequestDate).fromNow());
	res.redirect('/login'); // brute force protection triggered, send them back to the login page
};
// Start slowing requests after 5 failed attempts to do something for the same user
var userBruteforce = new ExpressBrute(store, {
	freeRetries: 5,
	proxyDepth: 1,
	minWait: 5*60*1000, // 5 minutes
	maxWait: 60*60*1000, // 1 hour,
	failCallback: failCallback
});
// No more than 1000 login attempts per day per IP
var globalBruteforce = new ExpressBrute(store, {
	freeRetries: 1000,
	proxyDepth: 1,
	attachResetToRequest: false,
	refreshTimeoutOnRequest: false,
	minWait: 25*60*60*1000, // 1 day 1 hour (should never reach this wait time)
	maxWait: 25*60*60*1000, // 1 day 1 hour (should never reach this wait time)
	lifetime: 24*60*60, // 1 day (seconds not milliseconds)
	failCallback: failCallback
});

app.post('/auth',
	globalBruteforce.prevent,
	userBruteforce.getMiddleware({
		key: function(req, res, next) {
			// prevent too many attempts for the same username
			next(req.body.username);
		}
	}),
	function (req, res, next) {
		if (User.isValidLogin(req.body.username, req.body.password)) { // omitted for the sake of conciseness
		 	// reset the failure counter so next time they log in they get 5 tries again before the delays kick in
			req.brute.reset(function () {
				res.redirect('/'); // logged in, send them to the home page
			});
		} else {
			res.flash('error', "Invalid username or password")
			res.redirect('/login'); // bad username/password, send them back to the login page
		}
	}
);
```

Changelog
---------
### v0.5.1
* BUG: When setting proxyDepth to 1, ips is never populated with proxied X-Forwarded-For IP.

### v0.5.0
* NEW: Added an additional `FailTooManyRequests` failure callback, that returns a 429 (TooManyRequests) error instead of 403 (Forbidden). This is a more accurate error status code.
* NEW: All the built in failure callbacks now set the "Retry-After" header to the number of seconds until it is safe to try again. Per [RFC6585](https://tools.ietf.org/html/rfc6585#section-4)
* NEW: Documentation updated to list some known store implementations.
* CHANGED: Default failure callback is now `FailTooManyRequests`. `FailForbidden` remains an option for backwards compatiblity.
* CHANGED: ExpressBrute.MemcachedStore is no longer included by default, and is now available as a separate module (because there are multiple store options it doesn't really make sense to include one by default).
* CHANGED: `FailMark` no longer sets returns 403 Forbidden, instead does 429 TooManyRequets.

### v0.4.2
* BUG: In some cases when no callbacks were supplied memcached would drop the request. Ensure that memcached always sees a callback even if ExpressBrute isn't given one.

### v0.4.1
* NEW: `refreshTimeoutOnRequest` option that allows you to prevent the remaining `lifetime` for a timer from being reset on each request (useful for implementing limits for set time frames, e.g. requests per day)
* BUG: Lifetimes were not previously getting extended properly for instances of `ExpressBrute.MemoryStore`

### v0.4.0
* NEW: `attachResetToRequest` parameter that lets you prevent the request object being decorated
* NEW: `failCallback` can be overriden by `getMiddleware`
* NEW: `proxyDepth` option on `ExpressBrute` that specifies how many levels of the `X-Forwarded-For` header to trust (inspired by [express-bouncer](https://github.com/dkrutsko/express-bouncer/)).
* NEW: `getIPFromRequest` method that essentially allows `reset` to used in a similar ways as in v0.2.2. This also respects the new `proxyDepth` setting.
* CHANGED: `getMiddleware` now takes an options object instead of the key directly.

### v0.3.0
* NEW: Support for using custom keys to group requests further (e.g. grouping login requests by username)
* NEW: Support for middleware from multiple instances of `ExpressBrute` on the same route.
* NEW: Tracking `lifetime` now has a reasonable default derived from the other settings for that instance of `ExpressBrute`
* NEW: Keys are now hashed before saving to a store, to prevent really long key names and reduce the possibility of collisions.
* NEW: There is now a convience method that gets attached to `req` object as `req.brute.reset`. It takes a single parameter (a callback), and will reset all the counters used by `ExpressBrute` middleware that was called for the current route.
* CHANGED: Tracking `lifetime` is now specified on `ExpressBrute` instead of `MemcachedStore`. This also means lifetime is now supported by MemoryStore.
* CHANGED: The function signature for `ExpressBrute.reset` has changed. It now requires an IP and key be passed instead of a request object.
* IMPROVED: Efficiency for large values of `freeRetries`.
* BUG: Removed a small chance of incorrectly triggering brute force protection.
