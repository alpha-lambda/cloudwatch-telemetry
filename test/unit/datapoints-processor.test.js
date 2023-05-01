'use strict';

const { expect } = require('chai');
const lambdaTester = require('lambda-tester');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const uuid = require('uuid');

const CloudWatchDriver = require('../../src/drivers/cloudwatch');
const handler = require('../../src/handler');
const setupTestHarness = require('../test-utils/setup-test-harness');

describe('datapoints-processor', function() {
  setupTestHarness({
    functionName: 'datapoints-processor'
  });

  beforeEach(function() {
    this.cloudwatch = {
      sendMetrics: this.sandbox.stub().resolves()
    };
    this.validateSQSEvent = this.sandbox.stub().yields();
    this.datapointsProcessor = proxyquire('../../src/datapoints-processor', {
      './handler': (options) => handler(options).use((event, context, next) => {
        Object.assign(context, {
          drivers: {
            cloudwatch: this.cloudwatch
          }
        });

        return next(null, context);
      })
    });
  });

  describe('validation', function() {
    it('should return error when event is missing required parameters', function() {
      const event = {};

      return lambdaTester(this.datapointsProcessor.handler)
        .event(event)
        .expectReject((err) => {
          expect(err.message).to.be.equal(
            'data must have required property \'Records\', '
            + 'data must be array, '
            + 'data must match exactly one schema in oneOf'
          );
        });
    });

    it('should return error when record is missing required parameters', function() {
      const event = {
        Records: [{}]
      };

      return lambdaTester(this.datapointsProcessor.handler)
        .event(event)
        .expectReject((err) => {
          expect(err.message).to.be.equal(
            'data/Records/0 must have required property \'kinesis\', '
            + 'data must be array, '
            + 'data must match exactly one schema in oneOf'
          );
        });
    });

    it('should return error when kinesis event is missing required parameters', function() {
      const event = {
        Records: [{
          kinesis: {}
        }]
      };

      return lambdaTester(this.datapointsProcessor.handler)
        .event(event)
        .expectReject((err) => {
          expect(err.message).to.be.equal(
            'data/Records/0/kinesis must have required property \'data\', '
            + 'data must be array, '
            + 'data must match exactly one schema in oneOf'
          );
        });
    });

    it('should not return error when event and kinesis event have unknown parameters', function() {
      const event = this.formatters.kinesisEvent({ datapoints: [] }, this.formatters.logEvent);
      event.unknown = 'unknown';
      event.Records[0].unknown = 'unknown';
      event.Records[0].kinesis.unknown = 'unknown';

      return lambdaTester(this.datapointsProcessor.handler)
        .event(event)
        .expectResolve();
    });

    it('should return error when datapoint is missing required parameters', function() {
      const datapoints = [{}];
      const event = this.formatters.kinesisEvent({ datapoints }, this.formatters.logEvent);

      return lambdaTester(this.datapointsProcessor.handler)
        .event(event)
        .expectReject((err) => {
          expect(err.message).to.be.equal(
            'data/0 must have required property \'name\', '
            + 'data/0 must have required property \'namespace\', '
            + 'data/0 must have required property \'dimensions\', '
            + 'data/0 must have required property \'points\''
          );
        });
    });

    it('should return error when datapoint parameters are invalid', function() {
      const datapoints = [{
        name: '',
        namespace: '',
        dimensions: {},
        points: {},
        unit: 'lb'
      }];
      const event = this.formatters.kinesisEvent({ datapoints }, this.formatters.logEvent);

      return lambdaTester(this.datapointsProcessor.handler)
        .event(event)
        .expectReject((err) => {
          expect(err.message).to.be.equal(
            'data/0/name must NOT have fewer than 1 characters, '
            + 'data/0/namespace must NOT have fewer than 1 characters, '
            + 'data/0/dimensions must NOT have fewer than 1 properties, '
            + 'data/0/points must be array, '
            + 'data/0/unit must be equal to one of the allowed values'
          );
        });
    });

    it('should return error when datapoint has unknown parameters', function() {
      const datapoints = [{
        name: 'testMetric',
        namespace: 'test-namespace',
        dimensions: {
          customerId: uuid.v4()
        },
        points: [{
          value: 12345,
          timestamp: 1542307422079, // 2018-11-15T18:43:42.079Z
        }],
        unit: CloudWatchDriver.UNITS.COUNT,
        unknown: 'unknown'
      }];
      const event = this.formatters.kinesisEvent({ datapoints }, this.formatters.logEvent);

      return lambdaTester(this.datapointsProcessor.handler)
        .event(event)
        .expectReject((err) => {
          expect(err.message).to.be.equal(
            'data/0 must NOT have additional properties'
          );
        });
    });

    it('should return error when point is missing required parameters', function() {
      const datapoints = [{
        name: 'testMetric',
        namespace: 'test-namespace',
        dimensions: {
          customerId: uuid.v4()
        },
        points: [{}],
        unit: CloudWatchDriver.UNITS.COUNT
      }];
      const event = this.formatters.kinesisEvent({ datapoints }, this.formatters.logEvent);

      return lambdaTester(this.datapointsProcessor.handler)
        .event(event)
        .expectReject((err) => {
          expect(err.message).to.be.equal(
            'data/0/points/0 must have required property \'value\', ' +
            'data/0/points/0 must have required property \'timestamp\''
          );
        });
    });

    it('should return error when point parameters are invalid', function() {
      const datapoints = [{
        name: 'testMetric',
        namespace: 'test-namespace',
        dimensions: {
          customerId: uuid.v4()
        },
        points: [{
          value: '1',
          timestamp: 'yesterday',
        }],
        unit: CloudWatchDriver.UNITS.COUNT
      }];
      const event = this.formatters.kinesisEvent({ datapoints }, this.formatters.logEvent);

      return lambdaTester(this.datapointsProcessor.handler)
        .event(event)
        .expectReject((err) => {
          expect(err.message).to.be.equal(
            'data/0/points/0/value must be number, ' +
            'data/0/points/0/timestamp must be integer'
          );
        });
    });

    it('should return error when point has unknown parameters', function() {
      const datapoints = [{
        name: 'testMetric',
        namespace: 'test-namespace',
        dimensions: {
          customerId: uuid.v4()
        },
        points: [{
          value: 12345,
          timestamp: 1542307422079, // 2018-11-15T18:43:42.079Z,]
          unknown: 'unknown'
        }],
        unit: CloudWatchDriver.UNITS.COUNT
      }];
      const event = this.formatters.kinesisEvent({ datapoints }, this.formatters.logEvent);

      return lambdaTester(this.datapointsProcessor.handler)
        .event(event)
        .expectReject((err) => {
          expect(err.message).to.be.equal(
            'data/0/points/0 must NOT have additional properties'
          );
        });
    });
  });

  it('should parse events and pass datapoints to cloudwatch driver', function() {
    const datapoints = {
      name: 'testMetric',
      namespace: 'test-namespace',
      dimensions: {
        customerId: uuid.v4()
      },
      points: [{
        value: 12345,
        timestamp: 1542307422079 // 2018-11-15T18:43:42.079Z
      }],
      unit: CloudWatchDriver.UNITS.COUNT
    };
    const event = this.formatters.kinesisEvent({ datapoints }, this.formatters.logEvent);

    return lambdaTester(this.datapointsProcessor.handler)
      .event(event)
      .expectResolve(() => {
        sinon.assert.alwaysCalledWithExactly(
          this.cloudwatch.sendMetrics,
          sinon.match.object,
          datapoints.namespace,
          [{
            name: datapoints.name,
            namespace: datapoints.namespace,
            dimensions: datapoints.dimensions,
            value: [datapoints.points[0].value],
            timestamp: '2018-11-15T18:43:00.000Z',
            unit: datapoints.unit
          }]
        );
      });
  });

  it('should ignore messages that are not DATA_MESSAGE', function() {
    const event = this.formatters.kinesisEvent({
      messageType: 'PING'
    });

    return lambdaTester(this.datapointsProcessor.handler)
      .event(event)
      .expectResolve(() => {
        sinon.assert.notCalled(this.cloudwatch.sendMetrics);
      });
  });

  it('should ignore messages that do not have datapoints', function() {
    const event = this.formatters.kinesisEvent({ message: 'processing event' }, this.formatters.logEvent);

    return lambdaTester(this.datapointsProcessor.handler)
      .event(event)
      .expectResolve(() => {
        sinon.assert.notCalled(this.cloudwatch.sendMetrics);
      });
  });

  it('should ignore events that do not have logEvents', function() {
    const event = this.formatters.kinesisEvent({
      messageType: 'DATA_MESSAGE',
      data: uuid.v4()
    });

    return lambdaTester(this.datapointsProcessor.handler)
      .event(event)
      .expectResolve(() => {
        sinon.assert.notCalled(this.cloudwatch.sendMetrics);
      });
  });

  it('should ignore events when logEvents is not an array', function() {
    const event = this.formatters.kinesisEvent({
      messageType: 'DATA_MESSAGE',
      logEvents: {}
    });

    return lambdaTester(this.datapointsProcessor.handler)
      .event(event)
      .expectResolve(() => {
        sinon.assert.notCalled(this.cloudwatch.sendMetrics);
      });
  });

  it('should support multiple datapoints within single log message', function() {
    const timestamp = 1542307422079; // 2018-11-15T18:43:42.079Z
    const baseDatapoint = {
      name: 'testMetric',
      namespace: 'test-namespace',
      dimensions: {
        customerId: uuid.v4()
      },
      unit: CloudWatchDriver.UNITS.COUNT
    };
    const datapoints = [
      { points: [{ value: 12345, timestamp }], ...baseDatapoint },
      { points: [{ value: 54321, timestamp }], ...baseDatapoint },
    ];
    const event = this.formatters.kinesisEvent({ datapoints }, this.formatters.logEvent);

    return lambdaTester(this.datapointsProcessor.handler)
      .event(event)
      .expectResolve(() => {
        sinon.assert.alwaysCalledWithExactly(
          this.cloudwatch.sendMetrics,
          sinon.match.object,
          baseDatapoint.namespace,
          [{
            name: baseDatapoint.name,
            namespace: baseDatapoint.namespace,
            dimensions: baseDatapoint.dimensions,
            value: [datapoints[0].points[0].value, datapoints[1].points[0].value],
            timestamp: '2018-11-15T18:43:00.000Z',
            unit: baseDatapoint.unit
          }]
        );
      });
  });

  it('should support multiple log events within single kinesis event', function() {
    const timestamp = 1542307422079; // 2018-11-15T18:43:42.079Z
    const baseDatapoint = {
      name: 'testMetric',
      namespace: 'test-namespace',
      dimensions: {
        customerId: uuid.v4()
      },
      unit: CloudWatchDriver.UNITS.COUNT
    };
    const datapoints = [
      { points: [{ value: 12345, timestamp }], ...baseDatapoint },
      { points: [{ value: 54321, timestamp }], ...baseDatapoint },
    ];
    const logRecords = datapoints.map((d) => ({ datapoints: d }));
    const event = this.formatters.kinesisEvent([logRecords], this.formatters.logEvent);

    return lambdaTester(this.datapointsProcessor.handler)
      .event(event)
      .expectResolve(() => {
        sinon.assert.alwaysCalledWithExactly(
          this.cloudwatch.sendMetrics,
          sinon.match.object,
          baseDatapoint.namespace,
          [{
            name: baseDatapoint.name,
            namespace: baseDatapoint.namespace,
            dimensions: baseDatapoint.dimensions,
            value: [datapoints[0].points[0].value, datapoints[1].points[0].value],
            timestamp: '2018-11-15T18:43:00.000Z',
            unit: baseDatapoint.unit
          }]
        );
      });
  });

  it('should support multiple kinesis events within single event', function() {
    const timestamp = 1542307422079; // 2018-11-15T18:43:42.079Z
    const baseDatapoint = {
      name: 'testMetric',
      namespace: 'test-namespace',
      dimensions: {
        customerId: uuid.v4()
      },
      unit: CloudWatchDriver.UNITS.COUNT
    };
    const datapoints = [
      { points: [{ value: 12345, timestamp }], ...baseDatapoint },
      { points: [{ value: 54321, timestamp }], ...baseDatapoint },
    ];
    const logRecords = datapoints.map((d) => ({ datapoints: d }));
    const event = this.formatters.kinesisEvent(logRecords, this.formatters.logEvent);

    return lambdaTester(this.datapointsProcessor.handler)
      .event(event)
      .expectResolve(() => {
        sinon.assert.alwaysCalledWithExactly(
          this.cloudwatch.sendMetrics,
          sinon.match.object,
          baseDatapoint.namespace,
          [{
            name: baseDatapoint.name,
            namespace: baseDatapoint.namespace,
            dimensions: baseDatapoint.dimensions,
            value: [datapoints[0].points[0].value, datapoints[1].points[0].value],
            timestamp: '2018-11-15T18:43:00.000Z',
            unit: baseDatapoint.unit
          }]
        );
      });
  });

  it('should aggregate datapoints based on namespace, name, dimensions and timestamp', function() {
    const datapoint = {
      name: 'testMetric',
      namespace: 'test-namespace',
      dimensions: {
        customerId: uuid.v4()
      },
      points: [{
        timestamp: 1542307422079, // 2018-11-15T18:43:42.079Z
        value: 12345
      }],
      unit: CloudWatchDriver.UNITS.COUNT
    };
    const datapointSameMinute = {
      ...datapoint,
      points: [{
        timestamp: 1542307430011, // 2018-11-15T18:43:50.011Z
        value: datapoint.points[0].value
      }]
    };
    const datapointDifferentMinute = {
      ...datapoint,
      points: [{
        timestamp: 1542307441025, // 2018-11-15T18:44:01.025Z
        value: datapoint.points[0].value
      }]
    };
    const datapointMultiplePoints = {
      ...datapoint,
      points: [
        {
          timestamp: 1542307425079, // 2018-11-15T18:43:45.079Z same minute
          value: 54321
        },
        {
          timestamp: 1542308335079, // 2018-11-15T18:58:55.079Z different minute
          value: 99999
        }
      ]
    };
    const datapointDifferentDimensions = { ...datapoint, dimensions: { customerId: uuid.v4() } };
    const datapointDifferentName = { ...datapoint, name: 'testMetric2' };
    const datapointDifferentNamespace = { ...datapoint, namespace: 'different-namespace' };
    const datapoints = [
      datapoint,
      datapointSameMinute,
      datapointDifferentMinute,
      datapointDifferentDimensions,
      datapointDifferentName,
      datapointMultiplePoints,
      datapointDifferentNamespace
    ];
    const event = this.formatters.kinesisEvent({ datapoints }, this.formatters.logEvent);

    return lambdaTester(this.datapointsProcessor.handler)
      .event(event)
      .expectResolve(() => {
        sinon.assert.calledTwice(this.cloudwatch.sendMetrics);
        sinon.assert.calledWithExactly(
          this.cloudwatch.sendMetrics,
          sinon.match.object,
          datapoint.namespace,
          [
            {
              name: datapoint.name,
              namespace: datapoint.namespace,
              dimensions: datapoint.dimensions,
              value: [
                datapoint.points[0].value,
                datapointSameMinute.points[0].value,
                datapointMultiplePoints.points[0].value
              ],
              timestamp: '2018-11-15T18:43:00.000Z',
              unit: datapoint.unit
            },
            {
              name: datapointDifferentMinute.name,
              namespace: datapointDifferentMinute.namespace,
              dimensions: datapointDifferentMinute.dimensions,
              value: [datapointDifferentMinute.points[0].value],
              timestamp: '2018-11-15T18:44:00.000Z',
              unit: datapointDifferentMinute.unit
            },
            {
              name: datapointDifferentDimensions.name,
              namespace: datapointDifferentDimensions.namespace,
              dimensions: datapointDifferentDimensions.dimensions,
              value: [datapointDifferentDimensions.points[0].value],
              timestamp: '2018-11-15T18:43:00.000Z',
              unit: datapointDifferentDimensions.unit
            },
            {
              name: datapointDifferentName.name,
              namespace: datapointDifferentName.namespace,
              dimensions: datapointDifferentName.dimensions,
              value: [datapointDifferentName.points[0].value],
              timestamp: '2018-11-15T18:43:00.000Z',
              unit: datapointDifferentName.unit
            },
            {
              name: datapointMultiplePoints.name,
              namespace: datapointMultiplePoints.namespace,
              dimensions: datapointMultiplePoints.dimensions,
              value: [datapointMultiplePoints.points[1].value],
              timestamp: '2018-11-15T18:58:00.000Z',
              unit: datapointMultiplePoints.unit
            }
          ]
        );
        sinon.assert.calledWithExactly(
          this.cloudwatch.sendMetrics,
          sinon.match.object,
          datapointDifferentNamespace.namespace,
          [
            {
              name: datapointDifferentNamespace.name,
              namespace: datapointDifferentNamespace.namespace,
              dimensions: datapointDifferentNamespace.dimensions,
              value: [datapointDifferentNamespace.points[0].value],
              timestamp: '2018-11-15T18:43:00.000Z',
              unit: datapointDifferentNamespace.unit
            }
          ]
        );
      });
  });

  it('should return error thrown by driver', function() {
    const error = new Error('CloudWatch error');
    const datapoints = {
      name: 'testMetric',
      namespace: 'test-namespace',
      dimensions: {
        customerId: uuid.v4()
      },
      points: [{
        value: 12345,
        timestamp: 1542307422079, // 2018-11-15T18:43:42.079Z
      }],
      unit: CloudWatchDriver.UNITS.COUNT
    };
    const event = this.formatters.kinesisEvent({ datapoints }, this.formatters.logEvent);

    this.cloudwatch.sendMetrics.rejects(error);

    return lambdaTester(this.datapointsProcessor.handler)
      .event(event)
      .expectReject((err) => {
        expect(err).to.deep.equal(error);
      });
  });
});
