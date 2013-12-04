var MemcachedStore = require('./MemcachedStore'),
    MemcachedMock = require('../mock/MemcachedMock'),
    _ = require('underscore');

var MemoryStore = module.exports = function (options) {
	options = _.extend({}, MemoryStore.defaults, options);
	MemcachedStore.call(this, [], options);
};
MemoryStore.prototype.__proto__ = MemcachedStore.prototype;
MemoryStore.prototype.Memcached = MemcachedMock;
MemoryStore.defaults = {};