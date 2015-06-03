var sinon = require("sinon");
module.exports = function () {
	return {
		status: sinon.stub(),
		send: sinon.stub(),
		header: sinon.stub()
	};
};