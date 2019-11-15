'use strict';

const sinon = require('sinon');

const generateAwsPromise = require('./generate-aws-promise');
const kinesisEventFormatter = require('./formatters/kinesis-event');
const logEventFormatter = require('./formatters/log-event');
const testContext = require('./provisioners/context');

module.exports = function(options = {}) {
  before(function() {
    this.sandbox = sinon.createSandbox();
    this.testContext = testContext(options.context);

    this.generateAwsPromise = generateAwsPromise;

    this.formatters = {
      kinesisEvent: kinesisEventFormatter,
      logEvent: logEventFormatter
    };
  });

  afterEach(function() {
    this.sandbox.restore();
  });
};
