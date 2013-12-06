var _ = require('underscore');

var MemcachedMock = module.exports = function () {
	this.data = {};
	_.bindAll(this, 'set', 'get', 'del');
};
MemcachedMock.prototype.set = function (key, value, lifetime, callback) {
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
MemcachedMock.prototype.get = function (key, callback) {
	typeof callback == 'function' && callback(null, this.data[key] && this.data[key].value);
};
MemcachedMock.prototype.del = function (key, callback) {
	if (this.data[key] && this.data[key].timeout) {
		clearTimeout(this.data[key].timeout);
	}
	delete this.data[key];
	typeof callback == 'function' && callback(null);
};