'use strict';

const AWS = require('aws-sdk');
const { expect } = require('chai');
const sinon = require('sinon');

const setupTestHarness = require('../../test-utils/setup-test-harness');
const CloudWatchDriver = require('../../../src/drivers/cloudwatch');

describe('cloudwatch-driver', function() {
  setupTestHarness();

  beforeEach(function() {
    this.driver = new CloudWatchDriver({ AWS, conf: {} });
    this.putMetricData = this.sandbox.stub(this.driver._client, 'putMetricData')
      .returns(this.generateAwsPromise());
  });

  it('should send metrics properly', function() {
    const namespace = 'test-namespace';
    const dimensionName = 'dimensionName';
    const rawMetrics = {
      name: 'metricName',
      dimensions: {
        [dimensionName]: 'dimensionValue'
      },
      value: 12345,
      unit: CloudWatchDriver.UNITS.COUNT,
      timestamp: Date.now()
    };

    return expect(this.driver.sendMetrics(this.testContext, namespace, rawMetrics))
      .to.eventually.be.fulfilled
      .then(() => {
        sinon.assert.calledOnce(this.putMetricData);
        sinon.assert.calledWithExactly(
          this.putMetricData,
          {
            Namespace: namespace,
            MetricData: [{
              MetricName: rawMetrics.name,
              Dimensions: [{
                Name: dimensionName,
                Value: rawMetrics.dimensions[dimensionName]
              }],
              Value: rawMetrics.value,
              Unit: rawMetrics.unit,
              Timestamp: rawMetrics.timestamp
            }]
          }
        );
      });
  });

  it('should use defaults when parameters are missing', function() {
    const namespace = 'test-namespace';
    const rawMetrics = {
      name: 'metricName',
      value: 12345
    };

    return expect(this.driver.sendMetrics(this.testContext, namespace, rawMetrics))
      .to.eventually.be.fulfilled
      .then(() => {
        sinon.assert.calledOnce(this.putMetricData);
        sinon.assert.calledWithExactly(
          this.putMetricData,
          {
            Namespace: namespace,
            MetricData: [{
              MetricName: rawMetrics.name,
              Dimensions: [],
              Value: rawMetrics.value
            }]
          }
        );
      });
  });

  it('should compute StatisticValues when value is an array', function() {
    const namespace = 'test-namespace';
    const rawMetrics = {
      name: 'metricName',
      value: [1, 2, 3, 4, 5]
    };

    return expect(this.driver.sendMetrics(this.testContext, namespace, rawMetrics))
      .to.eventually.be.fulfilled
      .then(() => {
        sinon.assert.calledOnce(this.putMetricData);
        sinon.assert.calledWithExactly(
          this.putMetricData,
          {
            Namespace: namespace,
            MetricData: [{
              MetricName: rawMetrics.name,
              Dimensions: [],
              StatisticValues: {
                Minimum: 1,
                Maximum: 5,
                SampleCount: 5,
                Sum: 15
              }
            }]
          }
        );
      });
  });

  it('should chunk metrics when metrics max count is exceeded', function() {
    const namespace = 'test-namespace';
    const rawMetrics = [
      { name: 'metric01', value: 1 },
      { name: 'metric02', value: 2 },
      { name: 'metric03', value: 3 },
      { name: 'metric04', value: 4 },
      { name: 'metric05', value: 5 },
      { name: 'metric06', value: 6 },
      { name: 'metric07', value: 7 },
      { name: 'metric08', value: 8 },
      { name: 'metric09', value: 9 },
      { name: 'metric10', value: 10 },
      { name: 'metric11', value: 11 },
      { name: 'metric12', value: 12 },
      { name: 'metric13', value: 13 },
      { name: 'metric14', value: 14 },
      { name: 'metric15', value: 15 },
      { name: 'metric16', value: 16 },
      { name: 'metric17', value: 17 },
      { name: 'metric18', value: 18 },
      { name: 'metric19', value: 19 },
      { name: 'metric20', value: 20 },
      { name: 'metric21', value: 21 }
    ];

    return expect(this.driver.sendMetrics(this.testContext, namespace, rawMetrics))
      .to.eventually.be.fulfilled
      .then(() => {
        sinon.assert.calledTwice(this.putMetricData);
        sinon.assert.calledWithExactly(
          this.putMetricData,
          {
            Namespace: namespace,
            MetricData: rawMetrics.slice(0, 20).map((metric) => {
              return {
                MetricName: metric.name,
                Dimensions: [],
                Value: metric.value
              };
            })
          }
        );
        sinon.assert.calledWithExactly(
          this.putMetricData,
          {
            Namespace: namespace,
            MetricData: [{
              MetricName: rawMetrics[20].name,
              Dimensions: [],
              Value: rawMetrics[20].value
            }]
          }
        );
      });
  });

  it('should not call CloudWatch when there are no metrics to send', function() {
    const namespace = 'test-namespace';
    const rawMetrics = [];

    return expect(this.driver.sendMetrics(this.testContext, namespace, rawMetrics))
      .to.eventually.be.fulfilled
      .then(() => {
        sinon.assert.notCalled(this.putMetricData);
      });
  });

  it('should re-throw CloudWatch error', function() {
    const error = new Error('CloudWatch error');
    const namespace = 'test-namespace';
    const rawMetrics = {
      name: 'metricName',
      value: 12345
    };

    this.putMetricData
      .returns(this.generateAwsPromise(Promise.reject(error)));

    return expect(this.driver.sendMetrics(this.testContext, namespace, rawMetrics))
      .to.be.rejectedWith(error)
      .then(() => {
        sinon.assert.calledOnce(this.putMetricData);
      });
  });
});
