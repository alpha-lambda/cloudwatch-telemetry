'use strict';

const yn = require('yn');

module.exports = {
  cloudwatch: {},
  logLevel: process.env.LOG_LEVEL || 'error',
  suppressErrors: yn(process.env.SUPPRESS_ERRORS, { default: false })
};
