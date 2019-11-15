'use strict';

const zlib = require('zlib');

const CloudWatchDriver = require('./drivers/cloudwatch');
const handler = require('./handler');
const { ajv, validate } = require('./ajv');

const OBJECT_SCHEMA = {
  type: 'object',
  required: ['Records'],
  additionalProperties: true,
  properties: {
    Records: {
      type: 'array',
      items: {
        type: 'object',
        required: ['kinesis'],
        properties: {
          kinesis: {
            type: 'object',
            required: ['data'],
            properties: {
              data: {
                type: 'string'
              },
            },
          },
        },
      },
    },
  },
};

const SCHEMA = ajv.compile({
  oneOf: [
    OBJECT_SCHEMA,
    {
      type: 'array',
      items: OBJECT_SCHEMA,
    },
  ],
});

const DATAPOINTS_SCHEMA = ajv.compile({
  type: 'array',
  items: {
    type: 'object',
    required: ['name', 'namespace', 'dimensions', 'points'],
    additionalProperties: false,
    properties: {
      name: {
        type: 'string',
        minLength: 1,
      },
      namespace: {
        type: 'string',
        minLength: 1,
      },
      dimensions: {
        type: 'object',
        minProperties: 1,
        additionalProperties: true,
      },
      points: {
        type: 'array',
        items: {
          type: 'object',
          required: ['value', 'timestamp'],
          additionalProperties: false,
          properties: {
            value: {
              type: 'number',
              minimum: 0,
            },
            timestamp: {
              type: 'integer',
              minimum: 1,
            },
          },
        },
      },
      unit: {
        type: 'string',
        enum: Object.values(CloudWatchDriver.UNITS),
      },
    },
  },
});

function parseDatapoints() {
  return (event, context, next) => {
    const datapoints = event.Records.reduce((acc, record) => {
      const payload = Buffer.from(record.kinesis.data, 'base64');
      const unzipped = zlib.gunzipSync(payload);
      const parsed = JSON.parse(unzipped.toString('utf8'));

      context.log.debug({ parsed }, 'parsed kinesis event');
      if (parsed.messageType === 'DATA_MESSAGE') {
        if (parsed.logEvents && Array.isArray(parsed.logEvents)) {
          parsed.logEvents.forEach((log) => {
            const message = JSON.parse(log.message);
            if (!message.datapoints) {
              context.log.warn({ message }, 'message does not contain datapoints');
              return;
            }

            const points = [].concat(message.datapoints);
            const error = validate(DATAPOINTS_SCHEMA, points);
            if (error) { throw error; }

            acc.push(...points);
          });
        } else {
          context.log.warn({ parsed }, 'event does not contain array of log events');
        }
      }

      return acc;
    }, []);

    return next(null, null, datapoints);
  };
}

function processDatapoints() {
  return (datapoints, context) => {
    const { cloudwatch } = context.drivers;
    const datapointsByNamespace = datapoints.reduce((acc, datapoint) => {
      acc[datapoint.namespace]
        ? acc[datapoint.namespace].push(datapoint)
        : acc[datapoint.namespace] = [datapoint];
      return acc;
    }, {});

    return Promise.all(Object.entries(datapointsByNamespace).map(([namespace, groups]) => {
      const aggregated = groups.reduce((acc, group) => {
        const dimensions = Object.values(group.dimensions).sort().join(':');
        const { points, ...other } = group;

        group.points.forEach(({ timestamp, value }) => {
          const pointTimestamp = new Date(timestamp).setSeconds(0, 0);
          const key = `${group.name}:${pointTimestamp}:${dimensions}`;
          const metric = acc.get(key);

          if (metric) {
            metric.value.push(value);
          } else {
            acc.set(key, {
              ...other,
              timestamp: new Date(pointTimestamp).toISOString(),
              value: [value]
            });
          }
        });

        return acc;
      }, new Map());

      return cloudwatch.sendMetrics(context, namespace, Array.from(aggregated.values()));
    }));
  };
}

function validateEvent() {
  return (event, context, next) => {
    const error = validate(SCHEMA, event);
    if (error) { throw error; }

    return next();
  };
}

module.exports.handler = handler()
  .use(validateEvent())
  .use(parseDatapoints())
  .use(processDatapoints());
