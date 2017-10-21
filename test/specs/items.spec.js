var chai = require('chai')
var merger = require('../../src')
var expect = chai.expect

describe('items', function() {
  it('merges additionalItems', function() {
    var result = merger({
      allOf: [{
        additionalItems: {
          properties: {
            name: {
              type: 'string',
              pattern: 'bar'
            }
          }
        }
      }, {
        additionalItems: {
          properties: {
            name: {
              type: 'string',
              pattern: 'foo'
            }
          }
        }
      }]
    })

    expect(result).to.eql({
      additionalItems: {
        properties: {
          name: {
            type: 'string',
            allOf: [{
              pattern: 'bar'
            }, {
              pattern: 'foo'
            }]
          }
        }
      }
    })
  })

  describe('when single schema', function() {
    it('merges them', function() {
      var result = merger({
        items: {
          type: 'string',
          allOf: [{
            minLength: 5
          }]
        },
        allOf: [{
          items: {
            type: 'string',
            pattern: 'abc.*',
            allOf: [{
              maxLength: 7
            }]
          }
        }]
      })

      expect(result).to.eql({
        items: {
          type: 'string',
          pattern: 'abc.*',
          minLength: 5,
          maxLength: 7
        }
      })
    })
  })

  describe('when array', function() {
    it('merges them in when additionalItems are all undefined', function() {
      var result = merger({
        items: [{
          type: 'string',
          allOf: [{
            minLength: 5
          }]
        }],
        allOf: [{
          items: [{
            type: 'string',
            allOf: [{
              minLength: 5
            }]
          }, {
            type: 'integer'
          }]
        }]
      })

      expect(result).to.eql({
        items: [{
          type: 'string',
          minLength: 5
        }, {
          type: 'integer'
        }]
      })
    })

    it('merges in additionalItems from one if present', function() {
      var result = merger({
        items: [{
          type: 'string',
          allOf: [{
            minLength: 5
          }]
        }],
        additionalItems: false,
        allOf: [{
          items: [{
            type: 'string',
            allOf: [{
              minLength: 5
            }]
          }, {
            type: 'integer'
          }]
        }]
      })

      expect(result).to.eql({
        additionalItems: false,
        items: [{
          type: 'string',
          minLength: 5
        }]
      })
    })
  })

  describe('when mixed array and object', function() {
    it('merges then maybe??')
    it('considers additionalItems')
  })
})
