module.exports = function () {
	return {
		status: jasmine.createSpy(),
		send: jasmine.createSpy()
	};
};