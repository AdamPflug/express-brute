var chai = require('chai'),
	should = chai.should(),
    sinon = require('sinon'),
    sinonChai = require('sinon-chai'),
    ExpressBrute = require("../index"),
    ResponseMock = require('../mock/ResponseMock');

chai.use(sinonChai);

describe("express brute", function () {
	var clock;
	before(function () {
		clock = sinon.useFakeTimers();
	});
	after(function () {
		clock.restore();
	});
	describe("basic functionality", function () {
		it("has some memory stores", function () {
			ExpressBrute.MemoryStore.should.exist;
		});
		it("can be initialized", function () {
			var store = new ExpressBrute.MemoryStore();
			var brute = new ExpressBrute(store);
			brute.should.be.an.instanceof(ExpressBrute);
		});
	});
	describe("behavior", function () {
		var brute, store, errorSpy, nextSpy, req, req2;
		beforeEach(function () {
			store = new ExpressBrute.MemoryStore();
			errorSpy = sinon.stub();
			nextSpy = sinon.stub();
			req = function () { return { ip: '1.2.3.4' }; };
			req2 = function () { return { ip: '5.6.7.8' }; };
			brute = new ExpressBrute(store, {
				freeRetries: 0,
				minWait: 10,
				maxWait: 100,
				failCallback: errorSpy
			});
		});
		it('correctly calculates delays', function () {
			brute.delays.should.deep.equal([10,10,20,30,50,80,100]);
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
			errorSpy.should.not.have.been.called;
			brute.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.have.been.called;
		});
		it('respects free retries even with clock skew', function() {
			brute = new ExpressBrute(store, {
				freeRetries: 1,
				minWait: 10,
				maxWait: 100,
				failCallback: errorSpy
			});
			brute.prevent(req(), new ResponseMock(), nextSpy);
			clock.tick(-100);
			brute.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.not.have.been.called;
			brute.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.have.been.called;
		});
		it('correctly calculates delays when min and max wait are the same', function () {
			brute = new ExpressBrute(store, {
				freeRetries: 0,
				minWait: 10,
				maxWait: 10,
				failCallback: errorSpy
			});
			brute.delays.should.deep.equal([10]);
		});
		it ('calls next when the request is allowed', function () {
			brute.prevent(req(), new ResponseMock(), nextSpy);
			nextSpy.should.have.been.calledOnce;
			brute.prevent(req(), new ResponseMock(), nextSpy);
			nextSpy.should.have.been.calledOnce;
		});
		it ('calls the error callback when requests come in too quickly', function () {
			brute.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.not.have.been.called;
			brute.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.have.been.called;
		});
		it ('allows requests as long as you wait long enough', function () {

			brute.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.not.have.been.called;
			clock.tick(brute.delays[0]+1);
			brute.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.not.have.been.called;
		});
		it ('allows requests if you reset the timer', function (done) {
			brute.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.not.have.been.called;
			var async = false;
			brute.reset('1.2.3.4', null, function () {
				async.should.be.true;
				brute.prevent(req(), new ResponseMock(), nextSpy);
				errorSpy.should.not.have.been.called;
				done();
			});
			async = true;

		});
		it('adds a reset shortcut to the request object', function (done) {
			var reqObj = req();
			brute.prevent(reqObj, new ResponseMock(), nextSpy);
			errorSpy.should.not.have.been.called;
			should.exist(reqObj.brute);
			should.exist(reqObj.brute.reset);
			reqObj.brute.reset(function () {
				brute.prevent(req(), new ResponseMock(), nextSpy);
				errorSpy.should.not.have.been.called;
				done();
			});
		});
		it("resets even if you don't pass a callback", function (done) {
			brute.prevent(req(), new ResponseMock(), nextSpy);
			brute.reset('1.2.3.4', null);
			process.nextTick(function () {
				brute.prevent(req(), new ResponseMock(), nextSpy);
				errorSpy.should.not.have.been.called;
				done();
			});
		});
		it ('allows requests if you use different ips', function () {
			brute.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.not.have.been.called;
			nextSpy.should.have.been.calledOnce;
			brute.prevent(req2(), new ResponseMock(), nextSpy);
			errorSpy.should.not.have.been.called;
			nextSpy.should.have.been.calledTwice;
		});
		it ('passes the correct next request time', function () {
			var curTime = Date.now(),
			    expectedTime = curTime+brute.delays[0];

			var oldNow = brute.now;
			brute.now = function () { return curTime; };
			brute.prevent(req(), new ResponseMock(), nextSpy);
			brute.now = oldNow;

			clock.tick(); // ensure some time has passed before calling the next time, caught a bug

			brute.prevent(req(), new ResponseMock(), errorSpy);
			errorSpy.should.have.been.called;
			errorSpy.lastCall.args[3].getTime().should.equal(expectedTime);
		});
		it('works even after the maxwait is reached', function () {
			brute = new ExpressBrute(store, {
				freeRetries: 0,
				minWait: 10,
				maxWait: 10,
				failCallback: function () {}
			});

			brute.prevent(req(), new ResponseMock(), nextSpy);
			brute.prevent(req(), new ResponseMock(), nextSpy);
			brute.options.failCallback = errorSpy;

			clock.tick(brute.delays[0]+1);

			var curTime = Date.now(),
			    expectedTime = curTime+brute.delays[0],
			    oldNow = brute.now;
			brute.now = function () { return curTime; };
			brute.prevent(req(), new ResponseMock(), nextSpy);
			brute.now = oldNow;
			brute.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.have.been.called;
			errorSpy.lastCall.args[3].getTime().should.equal(expectedTime);
		});
		it('correctly calculates default lifetime', function () {
			brute = new ExpressBrute(store, {
				freeRetries: 1,
				minWait: 100,
				maxWait: 1000,
				failCallback: errorSpy
			});
			brute.options.lifetime.should.equal(8);
		});
		it('allows requests after the lifetime causes them to expire', function () {
			brute = new ExpressBrute(store, {
				freeRetries: 0,
				minWait: 10000,
				maxWait: 10000,
				lifetime: 1,
				failCallback: errorSpy
			});
			brute.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.not.have.been.called;
			brute.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.have.been.called;

			clock.tick((brute.options.lifetime*1000)+1);

			brute.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.have.been.calledOnce;
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
			brute.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.not.have.been.called;
			brute.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.have.been.calledOnce;

			clock.tick((brute.options.lifetime*500));

			brute.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.have.been.calledTwice;

			clock.tick((brute.options.lifetime*500)+1);

			brute.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.have.been.calledTwice;
		});
		it('does extend the lifetime if refreshTimeoutOnRequest is true', function () {
			brute = new ExpressBrute(store, {
				freeRetries: 1,
				minWait: 10000,
				maxWait: 10000,
				lifetime: 1,
				failCallback: errorSpy
			});
			brute.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.not.have.been.called;

			clock.tick((brute.options.lifetime*500));

			brute.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.not.have.been.called;

			clock.tick((brute.options.lifetime*500)+1);

			brute.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.have.been.calledOnce;
		});
		it('allows failCallback to be overridden', function () {
			brute = new ExpressBrute(store, {
				freeRetries: 0,
				minWait: 10000,
				maxWait: 10000,
				lifetime: 1,
				failCallback: errorSpy
			});
			var errorSpy2 = sinon.stub();
			var mid = brute.getMiddleware({
				failCallback: errorSpy2
			});

			mid(req(), new ResponseMock(), nextSpy);
			errorSpy.should.not.have.been.called;
			errorSpy2.should.not.have.been.called;

			mid(req(), new ResponseMock(), nextSpy);
			errorSpy.should.not.have.been.called;
			errorSpy2.should.have.been.called;
		});
	});
	describe("multiple keys", function () {
		var brute, store, errorSpy, nextSpy, req;
		beforeEach(function () {
			store = new ExpressBrute.MemoryStore();
			errorSpy = sinon.stub();
			nextSpy = sinon.stub();
			req = function () { return { ip: '1.2.3.4' }; };
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
			nextSpy.should.have.been.calledOnce;
			second(req(), new ResponseMock(), nextSpy);
			nextSpy.should.have.been.calledTwice;

			first(req(), new ResponseMock(), nextSpy);
			nextSpy.should.have.been.calledTwice;
			second(req(), new ResponseMock(), nextSpy);
			nextSpy.should.have.been.calledTwice;
		});
		it ('supports key functions', function () {
			req = function () {
				return {
					ip: '1.2.3.4',
					someData: "something cool"
				};
			};
			var first = brute.getMiddleware({key: function(req, res, next) { next(req.someData); } });
			var second = brute.getMiddleware({key: "something cool" });

			first(req(), new ResponseMock(), nextSpy);
			nextSpy.should.have.been.calledOnce;
			first(req(), new ResponseMock(), nextSpy);
			nextSpy.should.have.been.calledOnce;
			second(req(), new ResponseMock(), nextSpy);
			nextSpy.should.have.been.calledOnce;
		});
		it('supports ignoring IP', function() {
			var req = function () {
				return {
					ip: '1.2.3.4'
				};
			};
			var req2 = function () {
				return {
					ip: '4.3.2.1'
				};
			};
			var first = brute.getMiddleware({key: "something cool", ignoreIP: true});
			first(req(), new ResponseMock(), nextSpy);
			nextSpy.should.have.been.calledOnce;
			first(req2(), new ResponseMock(), nextSpy);
			nextSpy.should.have.been.calledOnce;
		});
		it ('supports brute.reset', function () {
			var mid = brute.getMiddleware({key: 'withAKey' });

			mid(req(), new ResponseMock(), nextSpy);
			nextSpy.should.have.been.calledOnce;
			brute.reset("1.2.3.4", "withAKey");
			mid(req(), new ResponseMock(), nextSpy);
			nextSpy.should.have.been.calledTwice;
		});
		it ('supports req.reset shortcut', function () {
			var firstReq, mid = brute.getMiddleware({key: 'withAKey' });

			mid(firstReq = req(), new ResponseMock(), nextSpy);
			nextSpy.should.have.been.calledOnce;
			firstReq.brute.reset();
			mid(req(), new ResponseMock(), nextSpy);
			nextSpy.should.have.been.calledTwice;
		});
		it ('respects the attachResetToRequest', function () {
			brute.options.attachResetToRequest = false;
			var firstReq;

			brute.prevent(firstReq = req(), new ResponseMock(), nextSpy);
			nextSpy.should.have.been.calledOnce;
			should.not.exist(firstReq.brute);
		});
	});
	describe("multiple brute instances", function () {
		var brute, brute2, store, errorSpy, errorSpy2, nextSpy, req;
		beforeEach(function () {
			store = new ExpressBrute.MemoryStore();
			errorSpy = sinon.stub();
			errorSpy2 = sinon.stub();
			nextSpy = sinon.stub();
			req = function () { return { ip: '1.2.3.4' }; };
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
			brute.prevent(req(), new ResponseMock(), nextSpy);
			brute2.prevent(req(), new ResponseMock(), nextSpy);

			errorSpy.should.not.have.been.called;
			errorSpy2.should.not.have.been.called;

			brute.prevent(req(), new ResponseMock(), nextSpy);
			brute2.prevent(req(), new ResponseMock(), nextSpy);


			errorSpy.should.have.been.called;
			errorSpy2.should.not.have.been.called;

			brute.prevent(req(), new ResponseMock(), nextSpy);
			brute2.prevent(req(), new ResponseMock(), nextSpy);

			nextSpy.should.have.been.calledThrice;
			errorSpy2.should.have.been.called;
		});
		it ('resets both brute instances when the req.reset shortcut is called', function (done) {
			var failReq = req();
			var successSpy = sinon.stub();

			brute.prevent(req(), new ResponseMock(), nextSpy);
			brute2.prevent(req(), new ResponseMock(), nextSpy);
			brute2.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.not.have.been.called;
			errorSpy2.should.not.have.been.called;

			brute.prevent(failReq, new ResponseMock(), nextSpy);
			brute2.prevent(failReq, new ResponseMock(), nextSpy);
			errorSpy.should.have.been.called;
			errorSpy2.should.have.been.called;

			failReq.brute.reset(function () {
				brute.prevent(failReq, new ResponseMock(), successSpy);
				brute2.prevent(failReq, new ResponseMock(), successSpy);
				successSpy.should.have.been.calledTwice;
				done();
			});
		});
		it ('resets only one brute instance when the req.reset shortcut is called but attachResetToRequest is false on one', function (done) {
			brute2 = new ExpressBrute(store, {
				freeRetries: 1,
				minWait: 100,
				maxWait: 1000,
				failCallback: errorSpy2,
				lifetime: 0,
				attachResetToRequest: false
			});

			var failReq = req();
			var successStub = sinon.stub();

			brute.prevent(req(), new ResponseMock(), nextSpy);
			brute2.prevent(req(), new ResponseMock(), nextSpy);
			brute2.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.not.have.been.called;
			errorSpy2.should.not.have.been.called;

			brute.prevent(failReq, new ResponseMock(), nextSpy);
			brute2.prevent(failReq, new ResponseMock(), nextSpy);
			errorSpy.should.have.been.called;
			errorSpy2.should.have.been.called;

			failReq.brute.reset(function () {
				brute.prevent(failReq, new ResponseMock(), successStub);
				brute2.prevent(failReq, new ResponseMock(), successStub);
				successStub.should.have.been.called.once;
				done();
			});
		});
	});
	describe("failure handlers", function () {
		var brute, store, req, nextSpy;
		beforeEach(function () {
			store = new ExpressBrute.MemoryStore();
			req = function () { return { ip: '1.2.3.4' }; };
			nextSpy = sinon.stub();

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
			res.send.should.have.been.called;
			res.status.lastCall.args[0].should.equal(429);
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
			res.send.should.have.been.called;
			res.status.lastCall.args[0].should.equal(403);
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
			res.status.should.have.been.calledWith(429);
			nextSpy.should.have.been.calledTwice;
			res.nextValidRequestDate.should.exist;
			res.nextValidRequestDate.should.be.instanceof(Date);
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
			res.header.should.have.been.calledWith('Retry-After', 1);
		});
	});
	describe("store error handling", function () {
		var brute, store, errorSpy, storeErrorSpy, nextSpy, req, res, err;
		beforeEach(function () {
			store = new ExpressBrute.MemoryStore();
			errorSpy = sinon.stub();
			storeErrorSpy = sinon.stub();
			nextSpy = sinon.stub();
			req = { ip: '1.2.3.4' };
			res = new ResponseMock();
			err = "Example Error";
			brute = new ExpressBrute(store, {
				freeRetries: 0,
				minWait: 10,
				maxWait: 100,
				failCallback: errorSpy,
				handleStoreError: storeErrorSpy
			});
		});
		it('should handle get errors', function () {
			sinon.stub(store, 'get', function (key, callback) {
				callback(err);
			});
			brute.prevent(req, res, nextSpy);
			storeErrorSpy.should.have.been.calledWithMatch({
				req: req,
				res: res,
				next: nextSpy,
				message: 'Cannot get request count',
				parent: err
			});
			errorSpy.should.not.have.been.called;
			nextSpy.should.not.have.been.called;
		});
		it('should handle set errors', function () {
			sinon.stub(store, 'set', function (key, value, lifetime, callback) {
				callback(err);
			});
			brute.prevent(req, res, nextSpy);
			storeErrorSpy.should.have.been.calledWithMatch({
				req: req,
				res: res,
				next: nextSpy,
				message: 'Cannot increment request count',
				parent: err
			});
			errorSpy.should.not.have.been.called;
			nextSpy.should.not.have.been.called;
		});
		it('should handle reset errors', function () {
			sinon.stub(store, 'reset', function (key, callback) {
				callback(err);
			});
			var key = 'testKey';
			brute.reset('1.2.3.4', key, nextSpy);
			storeErrorSpy.should.have.been.calledWithMatch({
				message: "Cannot reset request count",
				parent: err,
				key: ExpressBrute._getKey(['1.2.3.4', brute.name, key]),
				ip: '1.2.3.4'
			});
			errorSpy.should.not.have.been.called;
			nextSpy.should.not.have.been.called;
		});
		it('should throw an exception by default', function () {
			brute = new ExpressBrute(store, {
				freeRetries: 0,
				minWait: 10,
				maxWait: 100,
				failCallback: errorSpy
			});
			sinon.stub(store, 'get', function (key, callback) {
				callback(err);
			});
			(function () {
				brute.prevent(req, res, nextSpy);
			}).should.throw({
				message: 'Cannot get request count',
				parent: err
			});
			errorSpy.should.not.have.been.called;
			nextSpy.should.not.have.been.called;
		});
	});
	describe('MemoryStore', function () {
		it('supports timeouts of greater than 24.8 days (64 bit timeouts)', function () {
			var yearInSeconds = 60*60*24*365;
			var store = new ExpressBrute.MemoryStore();
			var errorSpy = sinon.stub();
			var nextSpy = sinon.stub();
			var req = function () { return { ip: '1.2.3.4' }; };
			var brute = new ExpressBrute(store, {
				freeRetries: 0,
				minWait: (yearInSeconds+100)*1000,
				maxWait: (yearInSeconds+100)*1000,
				lifetime: yearInSeconds,
				failCallback: errorSpy
			});
			brute.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.not.have.been.called;
			clock.tick((brute.options.lifetime-100)*1000);

			brute.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.have.been.called;

			clock.tick(101*1000);

			brute.prevent(req(), new ResponseMock(), nextSpy);
			errorSpy.should.have.been.calledOnce;
		});
	});
});
