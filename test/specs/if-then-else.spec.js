const chai = require('chai')
const merger = require('../../src')
const expect = chai.expect

describe('if then else', function() {
  it('moves the if then else to the base schema if none there', () => {
    const result = merger({
      allOf: [{
        if: {
          required: ['prop1']
        },
        then: {},
        else: {}
      }]
    })

    expect(result).to.eql({
      if: {
        required: ['prop1']
      },
      then: {},
      else: {}
    })
  })

  it('does NOT move the if then else to the base schema if something already there', () => {
    const result = merger({
      if: {
        minimum: 5
      },
      then: {
        maximum: 2
      },
      else: {
        maximum: 10
      },
      allOf: [{
        if: {
          required: ['prop1']
        },
        then: {},
        else: {}
      }]
    })

    expect(result).to.eql({
      if: {
        minimum: 5
      },
      then: {
        maximum: 2
      },
      else: {
        maximum: 10
      },
      allOf: [{
        if: {
          required: ['prop1']
        },
        then: {},
        else: {}
      }]
    })
  })

  it('moves the unaffected keywords to the base schema', () => {
    const result = merger({
      properties: {
        name: {
          type: 'string',
          minLength: 3
        }
      },
      if: {
        minimum: 5
      },
      then: {
        maximum: 2
      },
      else: {
        maximum: 10
      },
      allOf: [{
        properties: {
          name: {
            type: 'string',
            minLength: 5
          }
        },
        if: {
          required: ['prop1']
        },
        then: {},
        else: {}
      }]
    })

    expect(result).to.eql({
      properties: {
        name: {
          type: 'string',
          minLength: 5
        }
      },
      if: {
        minimum: 5
      },
      then: {
        maximum: 2
      },
      else: {
        maximum: 10
      },
      allOf: [{
        if: {
          required: ['prop1']
        },
        then: {},
        else: {}
      }]
    })
  })

  it('should not move to base schema if only some keywords are not present', () => {
    const result = merger({
      else: false,
      allOf: [{
        if: {
          required: ['prop1']
        },
        then: {},
        else: {}
      }]
    })

    expect(result).to.eql({
      else: false,
      allOf: [{
        if: {
          required: ['prop1']
        },
        then: {},
        else: {}
      }]
    })

    const result2 = merger({
      then: false,
      allOf: [{
        if: {
          required: ['prop1']
        },
        then: {},
        else: {}
      }]
    })

    expect(result2).to.eql({
      then: false,
      allOf: [{
        if: {
          required: ['prop1']
        },
        then: {},
        else: {}
      }]
    })

    const result3 = merger({
      if: false,
      allOf: [{
        if: {
          required: ['prop1']
        },
        then: {},
        else: {}
      }]
    })

    expect(result3).to.eql({
      if: false,
      allOf: [{
        if: {
          required: ['prop1']
        },
        then: {},
        else: {}
      }]
    })
  })

  it('works with undefined value, it is as if not there. NOT the same as empty schema', () => {
    const result = merger({
      if: undefined,
      then: undefined,
      else: undefined,
      allOf: [{
        if: {
          required: ['prop1']
        },
        then: {},
        else: {}
      }]
    })

    expect(result).to.eql({
      if: {
        required: ['prop1']
      },
      then: {},
      else: {}
    })
  })

  it('removes empty allOf', () => {
    const result = merger({
      if: {
        required: ['prop1']
      },
      then: {},
      else: {},
      allOf: [{
        properties: {
          name: {
            type: 'string'
          }
        }
      }]
    })

    expect(result).to.eql({
      properties: {
        name: {
          type: 'string'
        }
      },
      if: {
        required: ['prop1']
      },
      then: {},
      else: {}
    })
  })

  it('works with resolver that does not manage to resolve it\'s schemas', () => {
    const result = merger({
      required: ['123'],
      if: {},
      then: {},
      else: {},
      allOf: [{
        required: ['234'],
        if: {
          required: ['prop1']
        },
        then: {},
        else: {}
      }]

    }, {
      resolvers: {
        foo(values, paths, mergeSchemas, options, reportUnresolved) {
          const key = paths.pop()
          reportUnresolved(values.map((val) => {
            return {
              [key]: val
            }
          }))
        }
      }
    })

    expect(result).to.eql({
      required: ['123', '234'],
      if: {},
      then: {},
      else: {},
      allOf: [{
        if: {
          required: ['prop1']
        },
        then: {},
        else: {}
      }]
    })
  })
})
