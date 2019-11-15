'use strict';

module.exports = function(messages) {
  return {
    messageType: 'DATA_MESSAGE',
    logEvents: [].concat(messages).map((message) => ({ message: JSON.stringify(message) }))
  };
};
