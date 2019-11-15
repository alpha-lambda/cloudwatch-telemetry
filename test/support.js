'use strict';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiSubset = require('chai-subset');

chai.use(chaiSubset);
chai.use(chaiAsPromised); // This one should be the last
