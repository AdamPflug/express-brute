var MemcachedMock = require('../mock/MemcachedMock'),
    proxyquire = require('proxyquire').noCallThru();
var MemcachedStore = proxyquire('../lib/MemcachedStore', {'memcached': MemcachedMock});

describe("Express brute memcached store", function () {
	var instance, callback, store;
	beforeEach(function () {
		instance = new MemcachedStore([], {prefix: 'test'});
		callback = jasmine.createSpy();
	});

	it("can be instantiated", function () {
		expect(instance).toBeDefined();
		expect(instance instanceof MemcachedStore).toBeTruthy();
	});
	it("can set a key and get it back", function () {
		var curDate = new Date(),
		    object = {count: 1, lastRequest: curDate, firstRequest: curDate};
		runs(function () {
			instance.set("1.2.3.4", object, 0, callback);
		});

		waitsFor(function () { return callback.calls.length == 1; });
		
		runs(function () {
			expect(callback).toHaveBeenCalledWith(null);

			instance.get("1.2.3.4", callback);
		});

		waitsFor(function () { return callback.calls.length == 2; });

		runs(function () {
			expect(callback.mostRecentCall.args[0]).toBe(null);
			expect(callback.mostRecentCall.args[1]).toEqual(object);
		});
	});
	it("increments values and returns that last value", function () {
		var curDate = new Date(),
		    object = {count: 1, lastRequest: curDate, firstRequest: curDate};
		runs(function () {
			instance.set("1.2.3.4", object, 0, callback);
		});

		waitsFor(function () { return callback.calls.length == 1; });
		
		runs(function () {
			expect(callback).toHaveBeenCalledWith(null);

			instance.increment("1.2.3.4", 0, callback);
		});

		waitsFor(function () { return callback.calls.length == 2; });

		runs(function () {
			expect(callback.mostRecentCall.args[0]).toBe(null);
			expect(callback.mostRecentCall.args[1]).toEqual(object);

			instance.get("1.2.3.4", callback);
		});

		waitsFor(function () { return callback.calls.length == 3; });

		runs(function () {
			expect(callback.mostRecentCall.args[0]).toBe(null);
			expect(callback.mostRecentCall.args[1].count).toEqual(2);
		});
	});
	it("can increment even if no value was set", function () {
		runs(function () {
			instance.increment("1.2.3.4", 0, callback);
		});

		waitsFor(function () { return callback.calls.length == 1; });

		runs(function () {
			expect(callback.mostRecentCall.args[0]).toBe(null);
			expect(callback.mostRecentCall.args[1]).toEqual({count: 0, lastRequest: null, firstRequest: null});

			instance.get("1.2.3.4", callback);
		});

		waitsFor(function () { return callback.calls.length == 2; });

		runs(function () {
			expect(callback.mostRecentCall.args[0]).toBe(null);
			expect(callback.mostRecentCall.args[1].count).toEqual(1);
			expect(callback.mostRecentCall.args[1].lastRequest instanceof Date).toBeTruthy();
			expect(callback.mostRecentCall.args[1].firstRequest instanceof Date).toBeTruthy();
		});
	});
	it("returns null when no value is available", function () {
		runs(function () {
			instance.get("1.2.3.4", callback);
		});

		waitsFor(function () { return callback.calls.length == 1; });

		runs(function () {
			expect(callback.mostRecentCall.args[0]).toBe(null);
			expect(callback.mostRecentCall.args[1]).toEqual(null);
		});
	});
	it("can reset the count of requests", function () {
		var curDate = new Date(),
		    object = {count: 1, lastRequest: curDate, firstRequest: curDate};
		runs(function () {
			instance.set("1.2.3.4", object, 0, callback);
		});

		waitsFor(function () { return callback.calls.length == 1; });
		
		runs(function () {
			expect(callback).toHaveBeenCalledWith(null);

			instance.get("1.2.3.4", callback);
		});

		waitsFor(function () { return callback.calls.length == 2; });

		runs(function () {
			expect(callback.mostRecentCall.args[0]).toBe(null);
			expect(callback.mostRecentCall.args[1]).toEqual(object);

			instance.reset("1.2.3.4", callback);
		});

		waitsFor(function () { return callback.calls.length == 3; });

		runs(function () {
			expect(callback.mostRecentCall.args[0]).toBe(null);

			instance.get("1.2.3.4", callback);
		});

		waitsFor(function () { return callback.calls.length == 4; });

		runs(function () {
			expect(callback.mostRecentCall.args[0]).toBe(null);
			expect(callback.mostRecentCall.args[1]).toEqual(null);
		});
	});
	it("supports data expiring", function () {
		var curDate = new Date(),
		    object = {count: 1, lastRequest: curDate, firstRequest: curDate};

		runs(function () {
			instance.set("1.2.3.4", object, 1, callback);
		});

		waitsFor(function () { return callback.calls.length == 1; });
		
		runs(function () {
			expect(callback).toHaveBeenCalledWith(null);
		});

		waits(500);

		runs(function () {
			instance.get("1.2.3.4", callback);
		});

		waitsFor(function () { return callback.calls.length == 2; });

		runs(function () {
			expect(callback.mostRecentCall.args[0]).toBe(null);
			expect(callback.mostRecentCall.args[1]).toEqual(object);
		});

		waits(500);

		runs(function () {
			instance.get("1.2.3.4", callback);
		});

		waitsFor(function () { return callback.calls.length == 3; });

		runs(function () {
			expect(callback.mostRecentCall.args[0]).toBe(null);
			expect(callback.mostRecentCall.args[1]).toEqual(null);
		});
	});
});