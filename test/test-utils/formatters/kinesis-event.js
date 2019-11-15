'use strict';

const zlib = require('zlib');

module.exports = function(data = [], formatter = ((v) => v)) {
  return {
    Records: [].concat(data).map((r) => formatter(r)).map((d) => {
      const compressed = zlib.gzipSync(JSON.stringify(d));
      return {
        kinesis: {
          data: compressed.toString('base64')
        }
      };
    })
  };
};
