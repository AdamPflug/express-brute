var ExpressBrute = require("../index"),
    ResponseMock = require('../mock/ResponseMock');

describe("express brute", function () {
	describe("basic functionality", function () {
		it("has some memory stores", function () {
			expect(ExpressBrute.MemoryStore).toBeDefined();
			expect(ExpressBrute.MemcachedStore).toBeDefined();
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
			req = { connection: { remoteAddress: '1.2.3.4' }};
			req2 = { connection: { remoteAddress: '5.6.7.8' }};
			brute = new ExpressBrute(store, {
				freeRetries: 0,
				minWait: 10,
				maxWait: 100,
				failCallback: errorSpy
			});
		});
		it('correctly calculates delays when there are no free requests', function () {
			expect(brute.delays).toEqual([10,10,20,30,50,80,100]);
		});
		it('correctly calculates delays when there are free requests', function () {
			brute = new ExpressBrute(store, {
				freeRetries: 1,
				minWait: 10,
				maxWait: 100,
				failCallback: errorSpy
			});
			expect(brute.delays).toEqual([0,10,10,20,30,50,80,100]);
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
			brute.prevent(req, new ResponseMock(), nextSpy);
			expect(nextSpy.calls.length).toEqual(1);
			brute.prevent(req, new ResponseMock(), nextSpy);
			expect(nextSpy.calls.length).toEqual(1);
		});
		it ('calls the error callback when requests come in too quickly', function () {
			brute.prevent(req, new ResponseMock(), nextSpy);
			expect(errorSpy).not.toHaveBeenCalled();
			brute.prevent(req, new ResponseMock(), nextSpy);
			expect(errorSpy).toHaveBeenCalled();
		});
		it ('allows requests as long as you wait long enough', function () {
			runs(function () {
				done = false;
				brute.prevent(req, new ResponseMock(), nextSpy);
				expect(errorSpy).not.toHaveBeenCalled();
				setTimeout(function() {
					done = true;
				}, brute.delays[0]+1);
			});
			waitsFor(function () { return done; });
			runs(function () {
				brute.prevent(req, new ResponseMock(), nextSpy);
				expect(errorSpy).not.toHaveBeenCalled();
			});
		});
		it ('allows requests if you reset the timer', function () {
			brute.prevent(req, new ResponseMock(), nextSpy);
			expect(errorSpy).not.toHaveBeenCalled();
			brute.reset(req);
			brute.prevent(req, new ResponseMock(), nextSpy);
			expect(errorSpy).not.toHaveBeenCalled();
		});
		it ('allows requests if you use different ips', function () {
			brute.prevent(req, new ResponseMock(), nextSpy);
			expect(errorSpy).not.toHaveBeenCalled();
			brute.prevent(req2, new ResponseMock(), nextSpy);
			expect(errorSpy).not.toHaveBeenCalled();
		});
		it ('passes the correct next request time', function () {
			runs(function () {
				brute.prevent(req, new ResponseMock(), nextSpy);
			});
			waits(5);
			runs(function () {
				var expectedTime = Date.now()+brute.delays[0];
				brute.prevent(req, new ResponseMock(), errorSpy);
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
				brute.prevent(req, new ResponseMock(), nextSpy);
				brute.prevent(req, new ResponseMock(), nextSpy);
				brute.options.failCallback = errorSpy;
			});
			waits(brute.delays[0]);
			runs(function () {
				brute.prevent(req, new ResponseMock(), nextSpy);
				var expectedTime = Date.now()+brute.delays[brute.delays.length-1];
				brute.prevent(req, new ResponseMock(), nextSpy);
				expect(errorSpy).toHaveBeenCalled();
				expect(errorSpy.mostRecentCall.args[3].getTime()).toEqual(expectedTime);
			});
		});
	});
	describe("failure handlers", function () {
		var brute, store, req, done, nextSpy;
		beforeEach(function () {
			store = new ExpressBrute.MemoryStore();
			req = { connection: { remoteAddress: '1.2.3.4' }};
			nextSpy = jasmine.createSpy();
			
		});
		it('can return a 403 forbidden', function () {
			var res = {send: jasmine.createSpy()};
			brute = new ExpressBrute(store, {
				freeRetries: 0,
				minWait: 10,
				maxWait: 100,
				failCallback: ExpressBrute.FailForbidden
			});
			brute.prevent(req, res, nextSpy);
			brute.prevent(req, res, nextSpy);
			expect(res.send).toHaveBeenCalled();
			expect(res.send.mostRecentCall.args[0]).toEqual(403);
		});
		it('can mark a response as failed, but continue processing', function () {
			var res = {status: jasmine.createSpy()};
			brute = new ExpressBrute(store, {
				freeRetries: 0,
				minWait: 10,
				maxWait: 100,
				failCallback: ExpressBrute.FailMark
			});
			brute.prevent(req, res, nextSpy);
			brute.prevent(req, res, nextSpy);
			expect(res.status).toHaveBeenCalledWith(403);
			expect(nextSpy.calls.length).toEqual(2);
			expect(res.nextValidRequestDate).toBeDefined();
			expect(res.nextValidRequestDate instanceof Date).toBeTruthy();
		});
	});
});