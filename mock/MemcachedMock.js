var _ = require('underscore');

var MemcachedMock = module.exports = function (options) {
	this.data = {};
};
MemcachedMock.prototype.set = function (key, value, lifetime, callback) {
	this.data[key] = value;
	callback(null);
};
MemcachedMock.prototype.get = function (key, callback) {
	callback(null, this.data[key]);
};
MemcachedMock.prototype.del = function (key, callback) {
	delete this.data[key];
	callback(null);
};