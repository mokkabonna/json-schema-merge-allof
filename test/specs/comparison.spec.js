var chai = require('chai')
var simplifier = require('../../src')
var sinon = require('sinon')
var expect = chai.expect
var Ajv = require('ajv')

describe('comparison', function() {
  describe('validation only', function() {
    it('compares required unsorted')
    it('compares equal required empty array and undefined')
    it('compares equal properties empty object and undefined')
    it('compares equal patternProperties empty object and undefined')
    it('compares equal dependencies empty object and undefined')
    it('compares type unsorted')
    it('compares equal an empty schema, true and undefined')
    it('ignores metadata properties like title')
    it('compares anyOf unsorted')
    it('compares oneOf unsorted')
    it('compares allOf unsorted')
    it('compares enum unsorted')
    it('compares dependencies value if array unsorted')
    it('compares items SORTED')
    it('compares equal uniqueItems false and undefined')
    it('compares equal minLength undefined and 0')
    it('compares equal minItems undefined and 0')
    it('compares equal minProperties undefined and 0')
  })

  describe('complete', function() {
    it('includes all properties, like title')
  })
})
