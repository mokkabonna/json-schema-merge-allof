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
})
