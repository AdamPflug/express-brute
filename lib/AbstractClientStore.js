var AbstractClientStore = module.exports = function () {
	
};
AbstractClientStore.prototype.increment = function (key, lifetime, callback) {
	var self = this;
	this.get(key, function (err, value) {
		if (err) {
			callback(err);
		} else {
			var count = value ? value.count+1 : 1;
			self.set(key, {count: count, lastRequest: new Date(), firstRequest: new Date()}, lifetime, function (err) {
				var prevValue = {
					count: value ? value.count : 0,
					lastRequest: value ? value.lastRequest : null,
					firstRequest: value ? value.firstRequest : null
				};
				typeof callback == 'function' && callback(err, prevValue);
			});
		}
	});
};