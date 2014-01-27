var ExpressBrute = require("../index"),
    ResponseMock = require('../mock/ResponseMock');

describe("express brute", function () {
	describe("basic functionality", function () {
		it("has some memory stores", function () {
			expect(ExpressBrute.MemoryStore).toBeDefined();
		});
		it("can be initialized", function () {
			var store = new ExpressBrute.MemoryStore();
			var brute = new ExpressBrute(store);
			expect(brute).toBeDefined();
			expect(brute instanceof ExpressBrute).toBeTruthy();
		});
	});
	describe("behavior", function () {
		var brute, store, errorSpy, nextSpy, req, req2, done;
		beforeEach(function () {
			store = new ExpressBrute.MemoryStore();
			errorSpy = jasmine.createSpy();
			nextSpy = jasmine.createSpy();
			req = function () { return { connection: { remoteAddress: '1.2.3.4' }}; };
			req2 = function () { return { connection: { remoteAddress: '5.6.7.8' }}; };
			brute = new ExpressBrute(store, {
				freeRetries: 0,
				minWait: 10,
				maxWait: 100,
				failCallback: errorSpy
			});
		});
		it('correctly calculates delays', function () {
			expect(brute.delays).toEqual([10,10,20,30,50,80,100]);
		});
		it('respects free retries', function () {
			brute = new ExpressBrute(store, {
				freeRetries: 1,
				minWait: 10,
				maxWait: 100,
				failCallback: errorSpy
			});
			brute.prevent(req(), new ResponseMock(), nextSpy);
			brute.prevent(req(), new ResponseMock(), nextSpy);
			expect(errorSpy).not.toHaveBeenCalled();
			brute.prevent(req(), new ResponseMock(), nextSpy);
			expect(errorSpy).toHaveBeenCalled();
		});
		it('correctly calculates delays when min and max wait are the same', function () {
			brute = new ExpressBrute(store, {
				freeRetries: 0,
				minWait: 10,
				maxWait: 10,
				failCallback: errorSpy
			});
			expect(brute.delays).toEqual([10]);
		});
		it ('calls next when the request is allowed', function () {
			brute.prevent(req(), new ResponseMock(), nextSpy);
			expect(nextSpy.calls.length).toEqual(1);
			brute.prevent(req(), new ResponseMock(), nextSpy);
			expect(nextSpy.calls.length).toEqual(1);
		});
		it ('calls the error callback when requests come in too quickly', function () {
			brute.prevent(req(), new ResponseMock(), nextSpy);
			expect(errorSpy).not.toHaveBeenCalled();
			brute.prevent(req(), new ResponseMock(), nextSpy);
			expect(errorSpy).toHaveBeenCalled();
		});
		it ('allows requests as long as you wait long enough', function () {
			runs(function () {
				done = false;
				brute.prevent(req(), new ResponseMock(), nextSpy);
				expect(errorSpy).not.toHaveBeenCalled();
			});
			waits(brute.delays[0]+1);
			runs(function () {
				brute.prevent(req(), new ResponseMock(), nextSpy);
				expect(errorSpy).not.toHaveBeenCalled();
			});
		});
		it ('allows requests if you reset the timer', function () {
			brute.prevent(req(), new ResponseMock(), nextSpy);
			expect(errorSpy).not.toHaveBeenCalled();
			brute.reset('1.2.3.4');
			brute.prevent(req(), new ResponseMock(), nextSpy);
			expect(errorSpy).not.toHaveBeenCalled();
		});
		it('adds a reset shortcut to the request object', function () {
			spyOn(brute, 'prevent').andCallThrough();
			brute.prevent(req(), new ResponseMock(), nextSpy);
			expect(errorSpy).not.toHaveBeenCalled();
			brute.prevent.mostRecentCall.args[0].brute.reset();
			brute.prevent(req(), new ResponseMock(), nextSpy);
			expect(errorSpy).not.toHaveBeenCalled();
		});
		it ('allows requests if you use different ips', function () {
			brute.prevent(req(), new ResponseMock(), nextSpy);
			expect(errorSpy).not.toHaveBeenCalled();
			brute.prevent(req2(), new ResponseMock(), nextSpy);
			expect(errorSpy).not.toHaveBeenCalled();
		});
		it ('passes the correct next request time', function () {
			var curTime = Date.now(),
			    expectedTime = curTime+brute.delays[0];
			runs(function () {
				var oldNow = brute.now;
				brute.now = function () { return curTime; };
				brute.prevent(req(), new ResponseMock(), nextSpy);
				brute.now = oldNow;
			});
			waits(1); // ensure some time has passed before calling the next time, caught a bug
			runs(function () {
				brute.prevent(req(), new ResponseMock(), errorSpy);
				expect(errorSpy).toHaveBeenCalled();
				expect(errorSpy.mostRecentCall.args[3].getTime()).toEqual(expectedTime);
			});

		});
		it('works even after the maxwait is reached', function () {
			brute = new ExpressBrute(store, {
				freeRetries: 0,
				minWait: 10,
				maxWait: 10,
				failCallback: function () {}
			});
			runs(function () {
				brute.prevent(req(), new ResponseMock(), nextSpy);
				brute.prevent(req(), new ResponseMock(), nextSpy);
				brute.options.failCallback = errorSpy;
			});
			waits(brute.delays[0]+1);
			runs(function () {
				var curTime = Date.now();
				    expectedTime = curTime+brute.delays[0];
				    oldNow = brute.now;
				brute.now = function () { return curTime; };
				brute.prevent(req(), new ResponseMock(), nextSpy);
				brute.now = oldNow;
				brute.prevent(req(), new ResponseMock(), nextSpy);
				expect(errorSpy).toHaveBeenCalled();
				expect(errorSpy.mostRecentCall.args[3].getTime()).toEqual(expectedTime);
			});
		});
		it('correctly calculates default lifetime', function () {
			brute = new ExpressBrute(store, {
				freeRetries: 1,
				minWait: 100,
				maxWait: 1000,
				failCallback: errorSpy
			});
			expect(brute.options.lifetime).toEqual(8);
		});
		it('allows requests after the lifetime causes them to expire', function () {
			brute = new ExpressBrute(store, {
				freeRetries: 0,
				minWait: 10000,
				maxWait: 10000,
				lifetime: 1,
				failCallback: errorSpy
			});
			runs(function () {
				brute.prevent(req(), new ResponseMock(), nextSpy);
				expect(errorSpy).not.toHaveBeenCalled();
				brute.prevent(req(), new ResponseMock(), nextSpy);
				expect(errorSpy).toHaveBeenCalled();
			});
			waits((brute.options.lifetime*1000)+1);
			runs(function () {
				brute.prevent(req(), new ResponseMock(), nextSpy);
				expect(errorSpy.calls.length).toEqual(1);
			});
		});
		it("doesn't extend the lifetime if refreshTimeoutOnRequest is false", function () {
			brute = new ExpressBrute(store, {
				freeRetries: 0,
				minWait: 10000,
				maxWait: 10000,
				lifetime: 1,
				refreshTimeoutOnRequest: false,
				failCallback: errorSpy
			});
			runs(function () {
				brute.prevent(req(), new ResponseMock(), nextSpy);
				expect(errorSpy).not.toHaveBeenCalled();
				brute.prevent(req(), new ResponseMock(), nextSpy);
				expect(errorSpy).toHaveBeenCalled();
			});
			waits((brute.options.lifetime*500));
			runs(function () {
				brute.prevent(req(), new ResponseMock(), nextSpy);
				expect(errorSpy.calls.length).toEqual(2);
			});
			waits((brute.options.lifetime*500)+1);
			runs(function () {
				brute.prevent(req(), new ResponseMock(), nextSpy);
				expect(errorSpy.calls.length).toEqual(2);
			});
		});
		it('does extend the lifetime if refreshTimeoutOnRequest is true', function () {
			brute = new ExpressBrute(store, {
				freeRetries: 1,
				minWait: 10000,
				maxWait: 10000,
				lifetime: 1,
				failCallback: errorSpy
			});
			runs(function () {
				brute.prevent(req(), new ResponseMock(), nextSpy);
				expect(errorSpy).not.toHaveBeenCalled();
			});
			waits((brute.options.lifetime*500));
			runs(function () {
				brute.prevent(req(), new ResponseMock(), nextSpy);
				expect(errorSpy).not.toHaveBeenCalled();
			});
			waits((brute.options.lifetime*500)+1);
			runs(function () {
				brute.prevent(req(), new ResponseMock(), nextSpy);
				expect(errorSpy).toHaveBeenCalled();
			});
		});
		it('allows failCallback to be overridden', function () {
			brute = new ExpressBrute(store, {
				freeRetries: 0,
				minWait: 10000,
				maxWait: 10000,
				lifetime: 1,
				failCallback: errorSpy
			});
			var errorSpy2 = jasmine.createSpy();
			var mid = brute.getMiddleware({
				failCallback: errorSpy2
			});

			mid(req(), new ResponseMock(), nextSpy);
			expect(errorSpy).not.toHaveBeenCalled();
			expect(errorSpy2).not.toHaveBeenCalled();
			mid(req(), new ResponseMock(), nextSpy);
			expect(errorSpy).not.toHaveBeenCalled();
			expect(errorSpy2).toHaveBeenCalled();
		});
	});
	describe("multiple keys", function () {
		var brute, store, errorSpy, nextSpy, req, done;
		beforeEach(function () {
			store = new ExpressBrute.MemoryStore();
			errorSpy = jasmine.createSpy();
			nextSpy = jasmine.createSpy();
			req = function () { return { connection: { remoteAddress: '1.2.3.4' }}; };
			brute = new ExpressBrute(store, {
				freeRetries: 0,
				minWait: 10,
				maxWait: 100,
				failCallback: errorSpy
			});
		});
		it ('tracks keys separately', function () {
			var first = brute.getMiddleware({key: 'first' });
			var second = brute.getMiddleware({key: 'second' });

			first(req(), new ResponseMock(), nextSpy);
			expect(nextSpy.calls.length).toEqual(1);
			second(req(), new ResponseMock(), nextSpy);
			expect(nextSpy.calls.length).toEqual(2);

			first(req(), new ResponseMock(), nextSpy);
			expect(nextSpy.calls.length).toEqual(2);
			second(req(), new ResponseMock(), nextSpy);
			expect(nextSpy.calls.length).toEqual(2);
		});
		it ('supports key functions', function () {
			req = function () {
				return {
					connection: {
						remoteAddress: '1.2.3.4'
					},
					someData: "something cool"
				};
			};
			var first = brute.getMiddleware({key: function(req, res, next) { next(req.someData); } });
			var second = brute.getMiddleware({key: "something cool" });

			first(req(), new ResponseMock(), nextSpy);
			expect(nextSpy.calls.length).toEqual(1);
			first(req(), new ResponseMock(), nextSpy);
			expect(nextSpy.calls.length).toEqual(1);
			second(req(), new ResponseMock(), nextSpy);
			expect(nextSpy.calls.length).toEqual(1);
		});
		it ('supports brute.reset', function () {
			var mid = brute.getMiddleware({key: 'withAKey' });

			mid(req(), new ResponseMock(), nextSpy);
			expect(nextSpy.calls.length).toEqual(1);
			brute.reset("1.2.3.4", "withAKey");
			mid(req(), new ResponseMock(), nextSpy);
			expect(nextSpy.calls.length).toEqual(2);
		});
		it ('supports req.reset shortcut', function () {
			var firstReq, mid = brute.getMiddleware({key: 'withAKey' });

			mid(firstReq = req(), new ResponseMock(), nextSpy);
			expect(nextSpy.calls.length).toEqual(1);
			firstReq.brute.reset();
			mid(req(), new ResponseMock(), nextSpy);
			expect(nextSpy.calls.length).toEqual(2);
		});
		it ('respects the attachResetToRequest', function () {
			brute.options.attachResetToRequest = false;
			var firstReq;

			brute.prevent(firstReq = req(), new ResponseMock(), nextSpy);
			expect(nextSpy.calls.length).toEqual(1);
			expect(firstReq.brute).toBeUndefined();
		});
	});
	describe('proxy severs', function () {
		var brute, store, errorSpy, nextSpy, req, req2;
		beforeEach(function () {
			store = new ExpressBrute.MemoryStore();
			errorSpy = jasmine.createSpy("errorSpy");
			nextSpy = jasmine.createSpy();
			req = function () {
				return {
					connection: {
						remoteAddress: '1.2.3.4'
					},
					get: function () {
						return '4.5.6.7, 3.4.5.6, 2.3.4.5, 1.2.3.4';
					}
				};
			};
			req2 = function () {
				return {
					connection: {
						remoteAddress: '1.2.3.4'
					},
					get: function () {
						return;
					}
				};
			};
			brute = new ExpressBrute(store, {
				freeRetries: 0,
				minWait: 100,
				maxWait: 1000,
				failCallback: errorSpy,
				lifetime: 0
			});
		});
		it ('gets the the right IP with when there is no x-forwared-for', function () {
			expect(brute.getIPFromRequest(req2())).toEqual('1.2.3.4');
		});
		it ('gets the the right IP with when there is no x-forwared-for and proxyDepth > 0', function () {
			brute.options.proxyDepth = 1;
			expect(brute.getIPFromRequest(req2())).toEqual('1.2.3.4');
		});
		it ('gets the the right IP with when proxyDepth is 0', function () {
			expect(brute.getIPFromRequest(req())).toEqual('1.2.3.4');
		});
		it ('gets the the right IP with when proxyDepth is greater than 0', function () {
			brute.options.proxyDepth = 1;
			expect(brute.getIPFromRequest(req())).toEqual('2.3.4.5');
		});
		it ('gets the the right IP with when proxyDepth is greater than the x-forwared-for length', function () {
			brute.options.proxyDepth = 10;
			expect(brute.getIPFromRequest(req())).toEqual('4.5.6.7');
		});
	});
	describe("multiple brute instances", function () {
		var brute, brute2, store, errorSpy, errorSpy2, nextSpy, req;
		beforeEach(function () {
			store = new ExpressBrute.MemoryStore();
			errorSpy = jasmine.createSpy("errorSpy");
			errorSpy2 = jasmine.createSpy("errorSpy2");
			nextSpy = jasmine.createSpy();
			req = function () { return { connection: { remoteAddress: '1.2.3.4' }}; };
			brute = new ExpressBrute(store, {
				freeRetries: 0,
				minWait: 100,
				maxWait: 1000,
				failCallback: errorSpy,
				lifetime: 0
			});
			brute2 = new ExpressBrute(store, {
				freeRetries: 1,
				minWait: 100,
				maxWait: 1000,
				failCallback: errorSpy2,
				lifetime: 0
			});
		});
		it ('tracks hits separately for each instance', function () {
			runs(function () {
				brute.prevent(req(), new ResponseMock(), nextSpy);
				brute2.prevent(req(), new ResponseMock(), nextSpy);
			});
			waitsFor(function () { return nextSpy.calls.length === 2; });
			runs(function () {
				expect(errorSpy).not.toHaveBeenCalled();
				expect(errorSpy2).not.toHaveBeenCalled();

				brute.prevent(req(), new ResponseMock(), nextSpy);
				brute2.prevent(req(), new ResponseMock(), nextSpy);
			});
			waitsFor(function () { return nextSpy.calls.length === 3; });
			runs(function () {
				expect(errorSpy).toHaveBeenCalled();
				expect(errorSpy2).not.toHaveBeenCalled();

				brute.prevent(req(), new ResponseMock(), nextSpy);
				brute2.prevent(req(), new ResponseMock(), nextSpy);
			});
			waitsFor(function () { return errorSpy.calls.length === 2; });
			runs(function () {
				expect(nextSpy.calls.length).toEqual(3);
				expect(errorSpy2).toHaveBeenCalled();
			});
		});
		it ('resets both brute instances when the req.reset shortcut is called', function () {
			var failReq = req();
			var successSpy = jasmine.createSpy("success spy");
			brute.prevent(req(), new ResponseMock(), nextSpy);
			brute2.prevent(req(), new ResponseMock(), nextSpy);
			brute2.prevent(req(), new ResponseMock(), nextSpy);
			expect(errorSpy).not.toHaveBeenCalled();
			expect(errorSpy2).not.toHaveBeenCalled();

			brute.prevent(failReq, new ResponseMock(), nextSpy);
			brute2.prevent(failReq, new ResponseMock(), nextSpy);
			expect(errorSpy).toHaveBeenCalled();
			expect(errorSpy2).toHaveBeenCalled();

			failReq.brute.reset(function () {
				brute.prevent(failReq, new ResponseMock(), successSpy);
				brute2.prevent(failReq, new ResponseMock(), successSpy);
				expect(successSpy.calls.length).toEqual(2);
			});

		});
		it ('resets only one brute instance when the req.reset shortcut is called but attachResetToRequest is false on one', function () {
			brute2 = new ExpressBrute(store, {
				freeRetries: 1,
				minWait: 100,
				maxWait: 1000,
				failCallback: errorSpy2,
				lifetime: 0,
				attachResetToRequest: false
			});

			var failReq = req();
			var successSpy = jasmine.createSpy("success spy");
			brute.prevent(req(), new ResponseMock(), nextSpy);
			brute2.prevent(req(), new ResponseMock(), nextSpy);
			brute2.prevent(req(), new ResponseMock(), nextSpy);
			expect(errorSpy).not.toHaveBeenCalled();
			expect(errorSpy2).not.toHaveBeenCalled();

			brute.prevent(failReq, new ResponseMock(), nextSpy);
			brute2.prevent(failReq, new ResponseMock(), nextSpy);
			expect(errorSpy).toHaveBeenCalled();
			expect(errorSpy2).toHaveBeenCalled();

			failReq.brute.reset(function () {
				brute.prevent(failReq, new ResponseMock(), successSpy);
				brute2.prevent(failReq, new ResponseMock(), successSpy);
				expect(successSpy.calls.length).toEqual(1);
			});

		});
	});
	describe("failure handlers", function () {
		var brute, store, req, done, nextSpy;
		beforeEach(function () {
			store = new ExpressBrute.MemoryStore();
			req = function () { return { connection: { remoteAddress: '1.2.3.4' }}; };
			nextSpy = jasmine.createSpy();

		});
		it('can return a 429 Too Many Requests', function () {
			var res = new ResponseMock();
			brute = new ExpressBrute(store, {
				freeRetries: 0,
				minWait: 10,
				maxWait: 100,
				failCallback: ExpressBrute.FailTooManyRequests
			});
			brute.prevent(req(), res, nextSpy);
			brute.prevent(req(), res, nextSpy);
			expect(res.send).toHaveBeenCalled();
			expect(res.send.mostRecentCall.args[0]).toEqual(429);
		});
		it('can return a 403 Forbidden', function () {
			var res = new ResponseMock();
			brute = new ExpressBrute(store, {
				freeRetries: 0,
				minWait: 10,
				maxWait: 100,
				failCallback: ExpressBrute.FailForbidden
			});
			brute.prevent(req(), res, nextSpy);
			brute.prevent(req(), res, nextSpy);
			expect(res.send).toHaveBeenCalled();
			expect(res.send.mostRecentCall.args[0]).toEqual(403);
		});
		it('can mark a response as failed, but continue processing', function () {
			var res = new ResponseMock();
			brute = new ExpressBrute(store, {
				freeRetries: 0,
				minWait: 10,
				maxWait: 100,
				failCallback: ExpressBrute.FailMark
			});
			brute.prevent(req(), res, nextSpy);
			brute.prevent(req(), res, nextSpy);
			expect(res.status).toHaveBeenCalledWith(429);
			expect(nextSpy.calls.length).toEqual(2);
			expect(res.nextValidRequestDate).toBeDefined();
			expect(res.nextValidRequestDate instanceof Date).toBeTruthy();
		});
		it('sets Retry-After', function () {
			var res = new ResponseMock();
			brute = new ExpressBrute(store, {
				freeRetries: 0,
				minWait: 10,
				maxWait: 100,
				failCallback: ExpressBrute.FailTooManyRequests
			});
			brute.prevent(req(), res, nextSpy);
			brute.prevent(req(), res, nextSpy);
			expect(res.header).toHaveBeenCalledWith('Retry-After', 1);
		});
	});
});
