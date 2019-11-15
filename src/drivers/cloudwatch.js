'use strict';

const chunk = require('lodash.chunk');

const METRIC_COUNT_LIMIT = 20;

class CloudWatchDriver {
  constructor({ AWS, conf }) {
    const clientOptions = { apiVersion: '2012-08-01', ...conf.client };
    this._client = new AWS.CloudWatch(clientOptions);
    this._conf = conf;
  }

  static get UNITS() {
    return {
      BITS: 'Bits',
      BITS_SECOND: 'Bits/Second',
      BYTES: 'Bytes',
      BYTES_SECOND: 'Bytes/Second',
      COUNT: 'Count',
      COUNT_SECOND: 'Count/Second',
      GIGABITS: 'Gigabits',
      GIGABITS_SECOND: 'Gigabits/Second',
      GIGABYTES: 'Gigabytes',
      GIGABYTES_SECOND: 'Gigabytes/Second',
      KILOBITS: 'Kilobits',
      KILOBITS_SECOND: 'Kilobits/Second',
      KILOBYTES: 'Kilobytes',
      KILOBYTES_SECOND: 'Kilobytes/Second',
      MEGABITS: 'Megabits',
      MEGABITS_SECOND: 'Megabits/Second',
      MEGABYTES: 'Megabytes',
      MEGABYTES_SECOND: 'Megabytes/Second',
      MICROSECONDS: 'Microseconds',
      MILLISECONDS: 'Milliseconds',
      NONE: 'None',
      PERCENT: 'Percent',
      SECONDS: 'Seconds',
      TERABITS: 'Terabits',
      TERABITS_SECONDS: 'Terabits/Second',
      TERABYTES: 'Terabytes',
      TERABYTES_SECOND: 'Terabytes/Second'
    };
  }

  sendMetrics(context, namespace, rawMetrics) {
    rawMetrics = [].concat(rawMetrics); // eslint-disable-line no-param-reassign

    return Promise.all(chunk(rawMetrics, METRIC_COUNT_LIMIT).map((metricsBatch) => {
      const metricsData = metricsBatch.map((rawMetric) => {
        const result = {
          MetricName: rawMetric.name,
          Dimensions: rawMetric.dimensions
            ? Object.entries(rawMetric.dimensions).map(([Name, Value]) => ({ Name, Value }))
            : [],
        };

        if (rawMetric.timestamp) {
          result.Timestamp = rawMetric.timestamp;
        }

        if (Array.isArray(rawMetric.value)) {
          result.StatisticValues = {
            Maximum: rawMetric.value.reduce((a, b) => Math.max(a, b)),
            Minimum: rawMetric.value.reduce((a, b) => Math.min(a, b)),
            SampleCount: rawMetric.value.length,
            Sum: rawMetric.value.reduce((a, b) => a + b)
          };
        } else {
          result.Value = rawMetric.value;
        }

        if (rawMetric.unit) {
          result.Unit = rawMetric.unit;
        }

        return result;
      });

      const metrics = {
        Namespace: namespace,
        MetricData: metricsData
      };

      context.log.debug({ metrics }, 'sending metrics');
      return this._client
        .putMetricData(metrics)
        .promise()
        .catch((err) => {
          context.log.error({ err, metrics }, 'failed to send metrics');
          err._logged = true; // eslint-disable-line no-param-reassign
          throw err;
        });
    }));
  }
}

module.exports = CloudWatchDriver;
