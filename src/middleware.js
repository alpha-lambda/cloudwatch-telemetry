'use strict';

const pino = require('pino');

module.exports.logging = ({ level = 'info' } = {}) => {
  const serializers = pino.stdSerializers;
  const redact = {
    paths: [
      'context.log',
      'context.drivers',
      'context.conf',
    ],
    remove: true,
  };

  const log = pino({
    level,
    redact,
    serializers,
    base: null,
  });

  return async (event, context, next) => {
    const {
      awsRequestId,
      functionName,
      functionVersion,
    } = context;

    Object.assign(context, {
      log: log.child({ awsRequestId }),
    });

    context.log.debug({ functionName, functionVersion });
    context.log.trace({ event }, 'incoming event');
    return next();
  };
};
