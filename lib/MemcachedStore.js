var AbstractClientStore = require('./AbstractClientStore'),
    Memcached = require('memcached'),
    _ = require('underscore');

var MemcachedStore = module.exports = function (options) {
	AbstractClientStore.apply(this, arguments);
	this.options = _.extend({}, MemcachedStore.deaults, options);
	this.client = new Memcached(options.hosts, options);
};
MemcachedStore.prototype.__proto__ = AbstractClientStore.prototype;
MemcachedStore.prototype.set = function (key, value, callback) {
	this.client.set(key, JSON.stringify(value), this.options.lifetime || 0, callback);
};
MemcachedStore.prototype.get = function (key, callback) {
	this.client.get(key, function (err, data) {
		if (err) {
			typeof callback == 'function' && callback(err,null);
		} else {
			if (data) {
				data = JSON.parse(data);
				data.lastRequest = new Date(data.lastRequest);
			}
			typeof callback == 'function' && callback(err, data);
		}
	});
};
MemcachedStore.prototype.reset = function (err, callback) {
	this.client.del(err, callback);
};
MemcachedStore.defaults = {
	lifetime: 1000*60*60*24 // one day
};