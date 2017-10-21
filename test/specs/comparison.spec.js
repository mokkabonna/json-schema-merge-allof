var chai = require('chai')
var compareModule = require('../../src/compare')
var expect = chai.expect

var compare = function(a, b, expected, options) {
  var result = compareModule(a, b, options)
  expect(result).to.equal(expected)
}

describe('comparison', function() {
  describe('validation only', function() {
    it('compares required unsorted', function() {
      compare({
        required: ['test', 'rest']
      }, {
        required: ['rest', 'test', 'rest']
      }, true)
    })
    it('compares equal required empty array and undefined', function() {
      compare({
        required: []
      }, {}, true)

      compare({
        required: ['fds']
      }, {}, false)
    })
    it('compares equal properties empty object and undefined', function() {
      compare({
        properties: {}
      }, {
      }, true)
    })
    it('compares properties', function() {
      compare({
        properties: {
          foo: {
            type: 'string'
          }
        }
      }, {
        properties: {
          foo: {
            type: 'string'
          }
        }
      }, true)
    })
    it('compares equal patternProperties empty object and undefined', function() {
      compare({
        patternProperties: {}
      }, {
      }, true)
    })
    it('compares equal dependencies empty object and undefined', function() {
      compare({
        dependencies: {}
      }, {
      }, true)
    })
    it('compares type unsorted', function() {
      compare({
        type: ['string', 'array']
      }, {
        type: ['array', 'string', 'array']
      }, true)

      compare({
      }, {
        type: []
      }, false)

      compare({
        type: 'string'
      }, {
        type: ['string']
      }, true)
    })
    it('compares equal an empty schema, true and undefined', function() {
      compare({}, true, true)
      compare({}, undefined, true)
      compare(false, false, true)
      compare(true, true, true)
    })
    it('ignores any in ignore list', function() {
      compare({
        title: 'title'
      }, {
        title: 'foobar'
      }, true, {
        ignore: ['title']
      })
    })
    it('sorts anyOf before comparing.. HOW??')
    it('sorts oneOf before comparing.. HOW??')
    it('sorts allOf before comparing.. HOW??')
    it('compares enum unsorted', function() {
      compare({
        enum: ['abc', '123']
      }, {
        enum: ['123', 'abc', 'abc']
      }, true)
    })
    it('compares dependencies value if array unsorted', function() {
      compare({
        dependencies: {
          foo: ['abc', '123']
        }
      }, {
        dependencies: {
          foo: ['123', 'abc', 'abc']
        }
      }, true)
    })
    it('compares items SORTED', function() {
      compare({
        items: [true, false]
      }, {
        items: [true, true]
      }, false)

      compare({
        items: [{}, false]
      }, {
        items: [true, false]
      }, true)
    })
    it('compares equal uniqueItems false and undefined', function() {
      compare({
        uniqueItems: false
      }, {}, true)
    })
    it('compares equal minLength undefined and 0', function() {
      compare({
        minLength: 0
      }, {}, true)
    })
    it('compares equal minItems undefined and 0', function() {
      compare({
        minItems: 0
      }, {}, true)
    })
    it('compares equal minProperties undefined and 0', function() {
      compare({
        minProperties: 0
      }, {}, true)
    })
  })

  describe('complete', function() {
    it('includes all properties, like title')
  })
})
