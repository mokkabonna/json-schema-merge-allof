import { describe, it, expect } from 'vitest';
import { mergeAndTest } from '../utils/merger.js';

describe('anyOf', function () {
  it('does not merge anyOf, only simplifies if no anyOf in base schema', function () {
    const result = mergeAndTest({
      allOf: [
        {
          anyOf: [
            {
              type: ['null', 'string', 'array']
            },
            {
              type: ['null', 'string', 'object']
            }
          ]
        },
        {
          anyOf: [
            {
              type: ['null', 'string']
            },
            {
              type: ['integer', 'object', 'null']
            }
          ]
        }
      ]
    });

    expect(result).to.eql({
      anyOf: [
        {
          type: ['null', 'string', 'array']
        },
        {
          type: ['null', 'string', 'object']
        }
      ],
      allOf: [
        {
          anyOf: [
            {
              type: ['null', 'string']
            },
            {
              type: ['integer', 'object', 'null']
            }
          ]
        }
      ]
    });
  });

  it('merges anyOf', function () {
    const result = mergeAndTest({
      allOf: [
        {
          anyOf: [
            {
              required: ['123']
            }
          ]
        },
        {
          anyOf: [
            {
              required: ['123']
            },
            {
              required: ['456']
            }
          ]
        }
      ]
    });

    expect(result).to.eql({
      anyOf: [
        {
          required: ['123']
        }
      ],
      allOf: [
        {
          anyOf: [
            {
              required: ['123']
            },
            {
              required: ['456']
            }
          ]
        }
      ]
    });
  });

  it('merges nested allOf if inside singular anyOf', function () {
    const result = mergeAndTest({
      allOf: [
        {
          anyOf: [
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
          anyOf: [
            {
              required: ['123']
            },
            {
              required: ['456']
            }
          ]
        }
      ]
    });

    expect(result).to.eql({
      anyOf: [
        {
          required: ['123', '768']
        }
      ],
      allOf: [
        {
          anyOf: [
            {
              required: ['123']
            },
            {
              required: ['456']
            }
          ]
        }
      ]
    });
  });

  it.skip('merges anyOf into main schema if left with only one combination', function () {
    const result = mergeAndTest({
      required: ['abc'],
      allOf: [
        {
          anyOf: [
            {
              required: ['123']
            },
            {
              required: ['456']
            }
          ]
        },
        {
          anyOf: [
            {
              required: ['123']
            }
          ]
        }
      ]
    });

    expect(result).to.eql({
      required: ['abc', '123']
    });
  });
});
