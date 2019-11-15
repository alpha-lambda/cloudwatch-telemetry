'use strict';

const { expect } = require('chai');
const uuid = require('uuid');
const sinon = require('sinon');

const DatapointsCollector = require('../../');
const setupTestHarness = require('../test-utils/setup-test-harness');

describe('DatapointsCollector', function() {
  setupTestHarness({
    context: { functionName: 'datapointsCollectorTest' }
  });

  beforeEach(function() {
    this.timeNow = Date.now();
    this.clock = sinon.useFakeTimers(this.timeNow);
  });

  describe('#constructor', function() {
    it('should throw when log is not passed', function() {
      expect(() => new DatapointsCollector())
        .to.throw(Error, 'missing log');
    });

    it('should throw when namespace is not passed', function() {
      const options = {
        log: {}
      };

      expect(() => new DatapointsCollector(options))
        .to.throw(Error, 'missing namespace');
    });

    it('should properly initialize initial state', function() {
      const datapointsCollector = new DatapointsCollector({
        auto: true,
        enabled: true,
        flushFrequency: 10000,
        log: this.testContext.log,
        maxDatapointsPerFlush: 12345,
        namespace: 'test'
      });

      expect(datapointsCollector)
        .to.containSubset({
          auto: true,
          flushFrequency: 10000,
          log: this.testContext.log,
          maxDatapointsPerFlush: 12345,
          namespace: 'test',
          _datapoints: [],
          _enabled: true,
          _stopped: false
        });

      expect(datapointsCollector).to.have.property('_flushTimer');
    });

    it('should use defaults for missing config options', function() {
      const datapointsCollector = new DatapointsCollector({
        log: this.testContext.log,
        namespace: 'test'
      });

      expect(datapointsCollector)
        .to.containSubset({
          auto: false,
          flushFrequency: 20000,
          log: this.testContext.log,
          maxDatapointsPerFlush: 500,
          namespace: 'test',
          _datapoints: [],
          _enabled: true,
          _stopped: true
        });

      expect(datapointsCollector).not.to.have.property('_flushTimer');
    });

    it('should be stopped when in auto mode, but disabled', function() {
      const datapointsCollector = new DatapointsCollector({
        log: this.testContext.log,
        namespace: 'test',
        auto: true,
        enabled: false
      });

      expect(datapointsCollector)
        .to.containSubset({
          auto: true,
          _enabled: false,
          _stopped: true
        });

      expect(datapointsCollector).not.to.have.property('_flushTimer');
    });
  });

  describe('#_setupFlushTimer', function() {
    it('should not create timer if metric collector is disabled', function() {
      const datapointsCollector = new DatapointsCollector({
        log: this.testContext.log,
        namespace: 'test',
        auto: true,
        enabled: false
      });

      datapointsCollector._setupFlushTimer();

      expect(datapointsCollector).not.to.have.property('_flushTimer');
    });

    it('should not create timer if metric collector is not in auto mode (stopped)', function() {
      const datapointsCollector = new DatapointsCollector({
        log: this.testContext.log,
        namespace: 'test',
        auto: false,
        enabled: true
      });

      datapointsCollector._setupFlushTimer();

      expect(datapointsCollector).to.have.property('_stopped', true);
      expect(datapointsCollector).not.to.have.property('_flushTimer');
    });

    it('should create a new timer when there is no current one', function() {
      const datapointsCollector = new DatapointsCollector({
        log: this.testContext.log,
        namespace: 'test',
        auto: true
      });

      delete datapointsCollector._flushTimer;
      expect(datapointsCollector).not.to.have.property('_flushTimer');

      datapointsCollector._setupFlushTimer();

      expect(datapointsCollector).to.have.property('_flushTimer');
    });

    it('should create a new timer and clear current one when it exists', function() {
      const datapointsCollector = new DatapointsCollector({
        log: this.testContext.log,
        namespace: 'test',
        auto: true
      });

      expect(datapointsCollector).to.have.property('_flushTimer');

      const initialTimer = datapointsCollector._flushTimer;
      datapointsCollector._setupFlushTimer();

      expect(datapointsCollector)
        .to.have.property('_flushTimer')
        .that.is.not.equal(initialTimer);
    });
  });

  describe('#add', function() {
    it('should support adding single metric', function() {
      const namespace = 'test-namespace';
      const datapointsCollector = new DatapointsCollector({
        log: this.testContext.log,
        namespace
      });
      const datapoint = {
        name: 'eventCount',
        dimensions: {
          eventName: 'LoginEvent',
          customerId: uuid.v4()
        },
        value: 1,
        units: DatapointsCollector.UNITS.COUNT
      };

      datapointsCollector.add(datapoint);

      expect(datapointsCollector.getAll())
        .to.deep.equal([{
          dimensions: datapoint.dimensions,
          name: datapoint.name,
          namespace,
          timestamp: this.timeNow,
          value: datapoint.value,
          units: datapoint.units
        }]);
    });

    it('should support adding multiple metrics', function() {
      const namespace = 'test-namespace';
      const datapointsCollector = new DatapointsCollector({
        log: this.testContext.log,
        namespace
      });
      const datapoints = [
        {
          name: 'eventCount',
          dimensions: {
            eventName: 'LoginEvent',
            customerId: uuid.v4()
          },
          value: 1,
          units: DatapointsCollector.UNITS.COUNT
        },
        {
          name: 'processingTime',
          dimensions: {
            eventName: 'LoginEvent'
          },
          value: 123,
          units: DatapointsCollector.UNITS.MILLIS
        }
      ];

      datapointsCollector.add(datapoints);

      expect(datapointsCollector.getAll())
        .to.deep.equal([
          {
            name: datapoints[0].name,
            namespace,
            timestamp: this.timeNow,
            dimensions: datapoints[0].dimensions,
            value: datapoints[0].value,
            units: datapoints[0].units
          },
          {
            name: datapoints[1].name,
            namespace,
            timestamp: this.timeNow,
            dimensions: datapoints[1].dimensions,
            value: datapoints[1].value,
            units: datapoints[1].units
          }
        ]);
    });

    it('should return instance as a result value', function() {
      const datapointsCollector = new DatapointsCollector({
        log: this.testContext.log,
        namespace: 'test-namespace'
      });
      const datapoint = {
        name: 'eventCount',
        dimensions: {
          eventName: 'LoginEvent'
        },
        value: 1,
        units: DatapointsCollector.UNITS.COUNT
      };

      expect(datapointsCollector.add(datapoint))
        .to.deep.equal(datapointsCollector);
    });

    it('should not add datapoints when disabled', function() {
      const datapointsCollector = new DatapointsCollector({
        log: this.testContext.log,
        namespace: 'test-namespace',
        enabled: false
      });
      const datapoint = {
        name: 'eventCount',
        dimensions: {
          eventName: 'LoginEvent',
          customerId: uuid.v4()
        },
        value: 1,
        units: DatapointsCollector.UNITS.COUNT
      };

      datapointsCollector.add(datapoint);

      expect(datapointsCollector.getAll())
        .to.deep.equal([]);
    });
  });

  describe('#getAll', function() {
    it('should return accumulated metrics as an array', function() {
      const namespace = 'test-namespace';
      const datapointsCollector = new DatapointsCollector({
        log: this.testContext.log,
        namespace
      });
      const datapoint = {
        name: 'eventCount',
        dimensions: {
          eventName: 'LoginEvent'
        },
        value: 1,
        units: DatapointsCollector.UNITS.COUNT
      };

      datapointsCollector.add(datapoint);

      expect(datapointsCollector.getAll())
        .to.deep.equal([{
          name: datapoint.name,
          namespace,
          timestamp: this.timeNow,
          dimensions: datapoint.dimensions,
          value: datapoint.value,
          units: datapoint.units
        }]);
    });

    it('should return empty array when there are no datapoints accumulated', function() {
      const datapointsCollector = new DatapointsCollector({
        log: this.testContext.log,
        namespace: 'test-namespace'
      });

      expect(datapointsCollector.getAll())
        .to.deep.equal([]);
    });
  });

  describe('#clear', function() {
    it('should clear accumulated metrics', function() {
      const datapointsCollector = new DatapointsCollector({
        log: this.testContext.log,
        namespace: 'test-namespace'
      });
      const datapoint = {
        name: 'eventCount',
        dimensions: {
          eventName: 'LoginEvent'
        },
        value: 1,
        units: DatapointsCollector.UNITS.COUNT
      };

      const result = datapointsCollector
        .add(datapoint)
        .clear();

      expect(result).to.deep.equal(datapointsCollector);
      expect(datapointsCollector.getAll()).to.deep.equal([]);
    });
  });

  describe('#stop', function() {
    it('should do nothing if stopped already', function() {
      const datapointsCollector = new DatapointsCollector({
        log: this.testContext.log,
        namespace: 'test-namespace',
        auto: false
      });

      const flushSpy = this.sandbox.spy(datapointsCollector, 'flush');

      datapointsCollector.stop();

      sinon.assert.notCalled(flushSpy);
    });

    it('should stop timer and flush metrics', function() {
      const datapointsCollector = new DatapointsCollector({
        log: this.testContext.log,
        namespace: 'test-namespace',
        auto: true
      });

      const flushSpy = this.sandbox.spy(datapointsCollector, 'flush');

      datapointsCollector.stop();

      expect(datapointsCollector._stopped).to.equal(true);
      sinon.assert.calledOnce(flushSpy);
    });

    it('should return instance as a result value', function() {
      const datapointsCollector = new DatapointsCollector({
        log: this.testContext.log,
        namespace: 'test-namespace',
        auto: false
      });

      expect(datapointsCollector.stop())
        .to.deep.equal(datapointsCollector);
    });
  });

  describe('#flush', function() {
    it('should not log metrics when there are no metrics accumulated', function() {
      const logStub = this.sandbox.stub();

      const datapointsCollector = new DatapointsCollector({
        log: logStub,
        namespace: 'test-namespace',
      });

      datapointsCollector.flush();

      sinon.assert.notCalled(logStub);
    });

    it('should log and clear metrics when there are metrics accumulated', function() {
      const logStub = this.sandbox.stub();

      const datapointsCollector = new DatapointsCollector({
        log: logStub,
        namespace: 'test-namespace',
      });

      const datapoint = {
        dimensions: { foo: 'bar' },
        name: 'importantMetric',
        value: 12345,
        unit: DatapointsCollector.UNITS.NONE
      };

      datapointsCollector.add(datapoint);
      const accumulatedMetrics = datapointsCollector.getAll();
      const expected = {
        dimensions: accumulatedMetrics[0].dimensions,
        points: [{
          timestamp: accumulatedMetrics[0].timestamp,
          value: accumulatedMetrics[0].value
        }],
        name: accumulatedMetrics[0].name,
        namespace: accumulatedMetrics[0].namespace,
        unit: accumulatedMetrics[0].unit
      };

      datapointsCollector.flush();

      expect(datapointsCollector.getAll()).to.deep.equal([]);
      sinon.assert.calledOnce(logStub);
      sinon.assert.calledWithExactly(logStub, { datapoints: [expected] }, 'datapoints for cw-telemetry');
    });

    it('should batch datapoints by name and dimensions', function() {
      const logStub = this.sandbox.stub();

      const datapointsCollector = new DatapointsCollector({
        log: logStub,
        namespace: 'test-namespace'
      });

      datapointsCollector.add([
        {
          dimensions: { foo: 'bar' },
          name: 'importantMetric',
          value: 12345,
          unit: DatapointsCollector.UNITS.NONE
        },
        {
          dimensions: { foo: 'bar' },
          name: 'importantMetric2',
          value: 11111,
          unit: DatapointsCollector.UNITS.NONE
        },
        {
          dimensions: { foo: 'bar' },
          name: 'importantMetric',
          value: 54321,
          unit: DatapointsCollector.UNITS.NONE
        },
        {
          dimensions: { foo: 'foobar' },
          name: 'importantMetric',
          value: 99999,
          unit: DatapointsCollector.UNITS.NONE
        },
      ]);
      const accumulatedMetrics = datapointsCollector.getAll();

      datapointsCollector.flush();

      expect(datapointsCollector.getAll()).to.deep.equal([]);
      sinon.assert.calledOnce(logStub);
      sinon.assert.calledWithExactly(
        logStub,
        {
          datapoints: [
            {
              dimensions: accumulatedMetrics[0].dimensions,
              points: [
                {
                  timestamp: accumulatedMetrics[0].timestamp,
                  value: accumulatedMetrics[0].value
                },
                {
                  timestamp: accumulatedMetrics[2].timestamp,
                  value: accumulatedMetrics[2].value
                }
              ],
              name: accumulatedMetrics[0].name,
              namespace: accumulatedMetrics[0].namespace,
              unit: accumulatedMetrics[0].unit
            },
            {
              dimensions: accumulatedMetrics[1].dimensions,
              points: [
                {
                  timestamp: accumulatedMetrics[1].timestamp,
                  value: accumulatedMetrics[1].value
                }
              ],
              name: accumulatedMetrics[1].name,
              namespace: accumulatedMetrics[1].namespace,
              unit: accumulatedMetrics[1].unit
            },
            {
              dimensions: accumulatedMetrics[3].dimensions,
              points: [
                {
                  timestamp: accumulatedMetrics[3].timestamp,
                  value: accumulatedMetrics[3].value
                }
              ],
              name: accumulatedMetrics[3].name,
              namespace: accumulatedMetrics[3].namespace,
              unit: accumulatedMetrics[3].unit
            }
          ]
        },
        'datapoints for cw-telemetry'
      );
    });

    it('should split datapoints when maxDatapointsPerFlush limit is reached', function() {
      const logStub = this.sandbox.stub();

      const datapointsCollector = new DatapointsCollector({
        log: logStub,
        maxDatapointsPerFlush: 2,
        namespace: 'test-namespace',
      });

      datapointsCollector.add([
        {
          dimensions: { foo: 'bar' },
          name: 'importantMetric',
          value: 12345,
          unit: DatapointsCollector.UNITS.NONE
        },
        {
          dimensions: { foo: 'bar' },
          name: 'importantMetric',
          value: 54321,
          unit: DatapointsCollector.UNITS.NONE
        },
        {
          dimensions: { foo: 'bar' },
          name: 'importantMetric',
          value: 99999,
          unit: DatapointsCollector.UNITS.NONE
        },
      ]);
      const accumulatedMetrics = datapointsCollector.getAll();

      datapointsCollector.flush();

      expect(datapointsCollector.getAll()).to.deep.equal([]);
      sinon.assert.calledTwice(logStub);
      sinon.assert.calledWithExactly(
        logStub,
        {
          datapoints: [{
            dimensions: accumulatedMetrics[0].dimensions,
            points: [
              {
                timestamp: accumulatedMetrics[0].timestamp,
                value: accumulatedMetrics[0].value
              },
              {
                timestamp: accumulatedMetrics[1].timestamp,
                value: accumulatedMetrics[1].value
              }
            ],
            name: accumulatedMetrics[0].name,
            namespace: accumulatedMetrics[0].namespace,
            unit: accumulatedMetrics[0].unit
          }]
        },
        'datapoints for cw-telemetry'
      );
      sinon.assert.calledWithExactly(
        logStub,
        {
          datapoints: [{
            dimensions: accumulatedMetrics[2].dimensions,
            points: [
              {
                timestamp: accumulatedMetrics[2].timestamp,
                value: accumulatedMetrics[2].value
              }
            ],
            name: accumulatedMetrics[2].name,
            namespace: accumulatedMetrics[2].namespace,
            unit: accumulatedMetrics[2].unit
          }]
        },
        'datapoints for cw-telemetry'
      );
    });

    it('should be called by timer in auto mode', function() {
      const datapointsCollector = new DatapointsCollector({
        log: this.testContext.log,
        namespace: 'test-namespace',
        auto: true,
        flushFrequency: 100
      });

      const flushSpy = this.sandbox.stub(datapointsCollector, 'flush');

      this.clock.tick(150);
      this.clock.runAll();

      sinon.assert.called(flushSpy);
    });

    it('should return instance as a result value', function() {
      const datapointsCollector = new DatapointsCollector({
        log: this.testContext.log,
        namespace: 'test-namespace',
        auto: false
      });

      expect(datapointsCollector.flush())
        .to.deep.equal(datapointsCollector);
    });
  });
});
