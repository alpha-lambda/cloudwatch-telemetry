'use strict';

const AWS = require('aws-sdk');
const pino = require('pino');

const CloudWatchDriver = require('../../../src/drivers/cloudwatch');
const conf = require('../../../src/conf');

const level = process.env.LOG_LEVEL || 'silent';
const serializers = pino.stdSerializers;
const redact = {
  paths: [
    'context.log',
    'context.drivers',
    'context.conf',
  ],
  remove: true,
};

const log = pino({ level, redact, serializers });

module.exports = function(options = {}) {
  return {
    awsRequestId: options.awsRequestId || '00112233445566778899',
    functionName: options.functionName || 'users-purge-test-testFunction',
    functionVersion: options.functionVersion || '$LATEST',
    getRemainingTimeInMillis: options.getRemainingTimeInMillis || (() => 0),
    drivers: {
      cloudwatch: new CloudWatchDriver({ AWS, conf: conf.cloudwatch })
    },
    log,
  };
};
