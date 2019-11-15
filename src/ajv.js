'use strict';

const AJV = require('ajv');

const ajv = new AJV({
  allErrors: true,
});

const validate = (validator, data) => {
  const valid = validator(data);

  if (valid) {
    return null;
  }

  return new Error(ajv.errorsText(validator.errors));
};

module.exports = {
  ajv,
  validate,
};
