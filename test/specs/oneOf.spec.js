import { describe, it, expect } from 'vitest';
import { mergeAndTest } from '../utils/merger.js';
import merger from '../../src/index.js';

describe('oneOf', function () {
  it('merges more complex oneOf', function () {
    const result = merger({
      allOf: [
        {
          oneOf: [
            {
              type: ['array', 'string', 'object'],
              required: ['123']
            },
            {
              required: ['abc']
            }
          ]
        },
        {
          oneOf: [
            {
              type: ['string']
            },
            {
              type: ['object', 'array'],
              required: ['abc']
            }
          ]
        }
      ]
    });

    expect(result).to.eql({
      oneOf: [
        {
          type: ['array', 'string', 'object'],
          required: ['123']
        },
        {
          required: ['abc']
        }
      ],
      allOf: [
        {
          oneOf: [
            {
              type: ['string']
            },
            {
              type: ['object', 'array'],
              required: ['abc']
            }
          ]
        }
      ]
    });
  });

  it('merges nested allOf if inside multiple oneOf', function () {
    const result = merger({
      allOf: [
        {
          type: ['array', 'string', 'number'],
          oneOf: [
            {
              type: ['array', 'object'],
              allOf: [
                {
                  type: 'object'
                }
              ]
            }
          ]
        },
        {
          type: ['array', 'string'],
          oneOf: [
            {
              type: 'string'
            },
            {
              type: 'object'
            }
          ]
        }
      ]
    });

    expect(result).to.eql({
      type: ['array', 'string'],
      oneOf: [
        {
          type: 'object'
        }
      ],
      allOf: [
        {
          oneOf: [
            {
              type: 'string'
            },
            {
              type: 'object'
            }
          ]
        }
      ]
    });
  });

  it('merges nested allOf if inside singular oneOf', function () {
    const result = mergeAndTest({
      allOf: [
        {
          type: ['array', 'string', 'number'],
          oneOf: [
            {
              required: ['123'],
              allOf: [
                {
                  required: ['768']
                }
              ]
            }
          ]
        },
        {
          type: ['array', 'string']
        }
      ]
    });

    expect(result).to.eql({
      type: ['array', 'string'],
      oneOf: [
        {
          required: ['123', '768']
        }
      ]
    });
  });

  it.skip('merges singular oneOf', function () {
    const result = merger({
      properties: {
        name: {
          type: 'string'
        }
      },
      allOf: [
        {
          properties: {
            name: {
              type: 'string',
              minLength: 10
            }
          }
        },
        {
          oneOf: [
            {
              required: ['123']
            },
            {
              properties: {
                name: {
                  type: 'string',
                  minLength: 15
                }
              }
            }
          ]
        },
        {
          oneOf: [
            {
              required: ['abc']
            },
            {
              properties: {
                name: {
                  type: 'string',
                  minLength: 15
                }
              }
            }
          ]
        }
      ]
    });

    expect(result).to.eql({
      properties: {
        name: {
          type: 'string',
          minLength: 15
        }
      }
    });
  });
});
