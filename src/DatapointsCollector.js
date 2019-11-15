'use strict';

const assert = require('assert');
const chunk = require('lodash.chunk');
const yn = require('yn');

const DEFAULT_FLUSH_FREQUENCY = 20000;
const DEFAULT_MAX_DATAPOINTS_PER_FLUSH = 500;
const UNITS = {
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

class DatapointsCollector {
  constructor(options = {}) {
    assert(options.log, 'missing log');
    assert(options.namespace, 'missing namespace');

    this.log = options.log;
    this.auto = options.auto || false;
    this.flushFrequency = options.flushFrequency || DEFAULT_FLUSH_FREQUENCY;
    this.maxDatapointsPerFlush = options.maxDatapointsPerFlush || DEFAULT_MAX_DATAPOINTS_PER_FLUSH;
    this.namespace = options.namespace;
    this._datapoints = [];
    this._enabled = yn(options.enabled, { default: true });
    this._stopped = !(this._enabled && this.auto);

    this._setupFlushTimer();
  }

  static get UNITS() {
    return UNITS;
  }

  get UNITS() {
    return UNITS;
  }

  _setupFlushTimer() {
    if (this._enabled && !this._stopped) {
      clearTimeout(this._flushTimer);
      this._flushTimer = setTimeout(
        this.flush.bind(this),
        this.flushFrequency
      );
    }
  }

  add(datapoints) {
    assert(datapoints, 'missing datapoints');

    if (this._enabled) {
      const timestamp = Date.now();
      [].concat(datapoints).forEach((datapoint) => {
        this._datapoints.push({
          ...datapoint,
          namespace: this.namespace,
          timestamp
        });
      });
    }

    return this;
  }

  clear() {
    this._datapoints = [];
    return this;
  }

  flush() {
    const datapoints = this.getAll();
    chunk(datapoints, this.maxDatapointsPerFlush).forEach((batch) => {
      const grouped = batch.reduce((acc, datapoint) => {
        const {
          dimensions,
          name,
          timestamp,
          unit = UNITS.NONE,
          value
        } = datapoint;

        const key = `${name}:${Object.values(dimensions).sort().join(':')}`;
        const group = acc.get(key) || {
          dimensions,
          points: [],
          name,
          namespace: this.namespace,
          unit
        };

        group.points.push({
          timestamp,
          value
        });

        return acc.set(key, group);
      }, new Map());

      this.log({ datapoints: Array.from(grouped.values()) }, 'datapoints for cw-telemetry');
    });

    this.clear();
    this._setupFlushTimer();

    return this;
  }

  getAll() {
    return this._datapoints;
  }

  stop() {
    if (this._stopped) {
      return this;
    }

    this._stopped = true;
    clearTimeout(this._flushTimer);
    return this.flush();
  }
}

module.exports = DatapointsCollector;
