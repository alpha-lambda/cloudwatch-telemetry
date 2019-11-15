'use strict';

const alpha = require('@alpha-lambda/handler');
const AWS = require('aws-sdk');

const CloudWatchDriver = require('./drivers/cloudwatch');
const conf = require('./conf');
const middleware = require('./middleware');

const {
  logging,
} = middleware;

const drivers = {
  cloudwatch: new CloudWatchDriver({ AWS, conf: conf.cloudwatch })
};

function formatResponse(context, result = {}) {
  context.log.trace({
    result
  }, 'request result');

  return result;
}

function handleError(context, event, err) {
  if (!err._logged) {
    context.log.error({
      err,
      event
    }, 'request resulted in error');
  }

  if (conf.suppressErrors) {
    return err;
  }

  throw err;
}

function mainWorkflow() {
  return (event, context, next) => {
    return Promise.resolve(next())
      .then((result) => formatResponse(context, result))
      .then((result) => {
        context.log.debug('request successfully processed');
        return result;
      })
      .catch((err) => handleError(context, event, err));
  };
}

module.exports = function handlerWorkflow() {
  return alpha()
    .with({ conf, drivers })
    .use(logging({ level: conf.logLevel }))
    .use(mainWorkflow());
};
