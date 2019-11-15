'use strict';

const { expect } = require('chai');
const lambdaTester = require('lambda-tester');

const CloudWatchDriver = require('../../src/drivers/cloudwatch');
const conf = require('../../src/conf');
const handler = require('../../src/handler');
const setupTestHarness = require('../test-utils/setup-test-harness');

describe('handler', function() {
  setupTestHarness({
    functionName: 'handler'
  });

  it('should add logger and drivers to the context', function(done) {
    const fixture = handler()
      .use((event, context) => {
        expect(context)
          .to.have.property('drivers')
          .that.has.property('cloudwatch')
          .that.is.an.instanceof(CloudWatchDriver);
        expect(context)
          .to.have.property('log');
        done();
      });

    lambdaTester(fixture)
      .event({})
      .expectResolve()
      .catch((err) => {
        done(err);
      });
  });

  it('should not return error when suppressErrors is set to true', function() {
    this.sandbox.replace(conf, 'suppressErrors', true);

    const error = new Error('big mistake');
    const fixture = handler()
      .use(() => {
        throw error;
      });

    return lambdaTester(fixture)
      .event({})
      .expectResolve();
  });

  it('should return error when suppressErrors is set to false', function() {
    this.sandbox.replace(conf, 'suppressErrors', false);

    const error = new Error('big mistake');
    const fixture = handler()
      .use(() => {
        throw error;
      });

    return lambdaTester(fixture)
      .event({})
      .expectReject((err) => {
        expect(err).to.deep.equal(error);
      });
  });
});
