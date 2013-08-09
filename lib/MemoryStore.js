var AbstractClientStore = require('./AbstractClientStore');

var MemoryStore = module.exports = function () {
	AbstractClientStore.apply(this, arguments);
	this.clients = {};
};
MemoryStore.prototype.__proto__ = AbstractClientStore.prototype;
MemoryStore.prototype.set = function (key, value, callback) {
	this.clients[key] = value;
	typeof callback == 'function' && callback(null);
};
MemoryStore.prototype.get = function (key, callback) {
	typeof callback == 'function' && callback(null, this.clients[key]);
};
MemoryStore.prototype.reset = function (key, callback) {
	delete this.clients[key];
	typeof callback == 'function' && callback(null);
};