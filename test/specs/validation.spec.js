var chai = require('chai')
var merger = require('../../src')
var sinon = require('sinon')
var expect = chai.expect
var Ajv = require('ajv')

describe('validation', function() {
  it('is false if property is required, but not allowed by patternProperties or additionalProperties')
  it('is false if any min value is bigger than a max value')
})
