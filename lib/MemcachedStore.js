var AbstractClientStore = require('./AbstractClientStore'),
    Memcached = require('memcached'),
    _ = require('underscore');

var MemcachedStore = module.exports = function (hosts, options) {
	AbstractClientStore.apply(this, arguments);
	this.options = _.extend({}, MemcachedStore.defaults, options);
	this.memcachedOptions = _(this.options).clone();
	delete this.memcachedOptions.prefix;

	this.client = new this.Memcached(hosts, this.options.memcachedOptions);
};
MemcachedStore.prototype.__proto__ = AbstractClientStore.prototype;
MemcachedStore.prototype.Memcached = Memcached;
MemcachedStore.prototype.set = function (key, value, lifetime, callback) {
	this.client.set(this.options.prefix+key, JSON.stringify(value), lifetime || 0, function (err, data) {
		typeof callback == 'function' && callback.apply(this, arguments);
	});
};
MemcachedStore.prototype.get = function (key, callback) {
	this.client.get(this.options.prefix+key, function (err, data) {
		if (err) {
			typeof callback == 'function' && callback(err, null);
		} else {
			if (data) {
				data = JSON.parse(data);
				data.lastRequest = new Date(data.lastRequest);
				data.firstRequest = new Date(data.firstRequest);
			}
			typeof callback == 'function' && callback(err, data);
		}
	});
};
MemcachedStore.prototype.reset = function (key, callback) {
	this.client.del(this.options.prefix+key, function (err, data) {
		typeof callback == 'function' && callback.apply(this, arguments);
	});
};
MemcachedStore.defaults = {
	prefix: ''
};