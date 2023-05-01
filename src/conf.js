'use strict';

module.exports = {
  cloudwatch: {},
  logLevel: process.env.LOG_LEVEL || 'error',
  suppressErrors: process.env.SUPPRESS_ERRORS === 'true',
};
