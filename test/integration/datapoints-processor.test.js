'use strict';

const AWS = require('aws-sdk');
const lambdaTester = require('lambda-tester');
const sinon = require('sinon');
const uuid = require('uuid');

const CloudWatchDriver = require('../../src/drivers/cloudwatch');
const datapointsProcessor = require('../../src/datapoints-processor');
const setupTestHarness = require('../test-utils/setup-test-harness');

describe('metrics-processor', function() {
  setupTestHarness({
    functionName: 'metrics-processor'
  });

  beforeEach(function() {
    this.cloudwatch = new CloudWatchDriver({ AWS, conf: {} });
    this.putMetricData = this.sandbox.stub(this.cloudwatch._client, 'putMetricData')
      .returns(this.generateAwsPromise());
  });

  it('should parse events and publish metrics to CloudWatch', function() {
    const clientId = uuid.v4();
    const datapoints = [{
      name: 'testMetric',
      namespace: uuid.v4(),
      dimensions: { clientId },
      points: [{
        value: 12345,
        timestamp: 1542307422079 // 2018-11-15T18:43:42.079Z
      }],
      unit: CloudWatchDriver.UNITS.COUNT
    }];
    const event = this.formatters.kinesisEvent({ datapoints }, this.formatters.logEvent);

    return lambdaTester(datapointsProcessor.handler)
      .event(event)
      .context({ drivers: { cloudwatch: this.cloudwatch } })
      .expectResolve(() => {
        sinon.assert.calledWithExactly(
          this.putMetricData,
          {
            Namespace: datapoints[0].namespace,
            MetricData: [{
              MetricName: datapoints[0].name,
              Dimensions: [{
                Name: 'clientId',
                Value: clientId
              }],
              StatisticValues: {
                Minimum: 12345,
                Maximum: 12345,
                SampleCount: 1,
                Sum: 12345
              },
              Unit: datapoints[0].unit,
              Timestamp: '2018-11-15T18:43:00.000Z'
            }]
          }
        );
      });
  });
});
