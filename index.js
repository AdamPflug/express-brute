var _ = require('underscore');

var ExpressBrute = module.exports = function (store, options) {
	var i;
	_.bindAll(this, 'prevent', 'reset');

	// set options
	this.options = _.extend({}, ExpressBrute.defaults, options);
	if (this.options.minWait < 1) {
		this.options.minWait++;
	}
	this.store = store;

	// build delays array
	this.delays = [];
	for (i = 0; i < this.options.freeRetries; i++) {
		this.delays[i] = 0;
	}
	this.delays.push(this.options.minWait);
	do {
		var nextNum = this.delays[this.delays.length-1] + (this.delays.length > 1 ? this.delays[this.delays.length-2] : 0);
		this.delays.push(nextNum);
	} while(this.delays[this.delays.length-1] < this.options.maxWait);
	this.delays[this.delays.length-1] = this.options.maxWait;
};
ExpressBrute.prototype.prevent = function (req, res, next) {
	this.store.increment(req.connection.remoteAddress, _.bind(function (err, value) {
		if (err) {
			throw "Cannot increment request count";
		}

		if (value.count < 1) {
			next();
		} else {
			var nextValidRequestTime = value.lastRequest.getTime()+this.delays[value.count-1];
			if (nextValidRequestTime < Date.now()) {
				next();
			} else {
				this.options.failCallback(req, res, next, new Date(nextValidRequestTime));
			}
		}
	}, this));
};
ExpressBrute.prototype.reset = function (req, callback) {
	this.store.reset(req.connection.remoteAddress, callback);
};

ExpressBrute.FailForbidden = function (req, res, next, nextValidRequestDate) {
	res.send(403, {error: {text: "Too many requests in this time frame.", nextValidRequestDate: nextValidRequestDate}});
};
ExpressBrute.FailMark = function (req, res, next, nextValidRequestDate) {
	res.status(403);
	res.nextValidRequestDate = nextValidRequestDate;
	next();
};
ExpressBrute.MemoryStore = require('./lib/MemoryStore');
ExpressBrute.MemcachedStore = require('./lib/MemcachedStore');
ExpressBrute.defaults = {
	freeRetries: 2,
	minWait: 500,
	maxWait: 1000*60*15, // 15 minutes
	failCallback: ExpressBrute.FailForbidden
};