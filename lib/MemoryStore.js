var AbstractClientStore = require('./AbstractClientStore'),
    _ = require('underscore');

var MemoryStore = module.exports = function (options) {
	this.data = {};
	_.bindAll(this, 'set', 'get', 'reset');
	this.options = _.extend({}, MemoryStore.defaults, options);
};
MemoryStore.prototype = Object.create(AbstractClientStore.prototype);
MemoryStore.prototype.set = function (key, value, lifetime, callback) {
	key = this.options.prefix+key;
	lifetime = lifetime || 0;
	value = JSON.stringify(value);

	if (!this.data[key]) {
		this.data[key] = {};
	} else if (this.data[key].timeout) {
		clearTimeout(this.data[key].timeout);
	}
	this.data[key].value = value;

	if (lifetime) {
		this.data[key].timeout = setTimeout(_.bind(function () {
			delete this.data[key];
		}, this), 1000*lifetime);
	}
	typeof callback == 'function' && callback(null);
};
MemoryStore.prototype.get = function (key, callback) {
	key = this.options.prefix+key;
	var data = this.data[key] && this.data[key].value;
	if (data) {
		data = JSON.parse(data);
		data.lastRequest = new Date(data.lastRequest);
		data.firstRequest = new Date(data.firstRequest);
	}
	typeof callback == 'function' && callback(null, data);
};
MemoryStore.prototype.reset = function (key, callback) {
	key = this.options.prefix+key;
	
	if (this.data[key] && this.data[key].timeout) {
		clearTimeout(this.data[key].timeout);
	}
	delete this.data[key];
	typeof callback == 'function' && callback(null);
};
MemoryStore.defaults = {
	prefix: ''
};