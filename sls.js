#!/usr/bin/env node

'use strict';

const { argv } = require('process');
const { exec } = require('shelljs');
const minimist = require('minimist');

const { _, ...rawOptions } = minimist(argv.slice(2));

const options = Object.entries(rawOptions).reduce((acc, [name, value]) => {
  acc.push(name === 'region' || name === 'stage'
    ? `--${name} ${value}`
    : `--param="${name}=${value}"`);

  return acc;
}, [..._]);

exec(`sls ${options.join(' ')}`);
