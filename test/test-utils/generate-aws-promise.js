'use strict';

module.exports = function(value) {
  return {
    promise() {
      return Promise.resolve()
        .then(() => (typeof value === 'function' ? value() : value));
    }
  };
};
