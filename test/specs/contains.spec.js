import { describe, it, expect } from 'vitest';
import { mergeAndTest } from '../utils/merger.js';

describe('pattern', function () {
  it('merges contains', function () {
    const result = mergeAndTest(
      {
        allOf: [
          {},
          {
            contains: {
              properties: {
                name: {
                  type: 'string',
                  minLength: 2,
                  pattern: 'bar'
                }
              }
            }
          },
          {
            contains: {
              properties: {
                name: {
                  type: 'string',
                  minLength: 1,
                  pattern: 'foo'
                }
              }
            }
          }
        ]
      },
      null,
      [
        [
          {
            name: 'somethingelse'
          },
          {
            name: 'bar'
          }
        ],
        [
          {
            name: 'foobar'
          }
        ],
        [
          {
            name: 'bar'
          },
          {
            name: 'foo'
          }
        ],
        [
          {
            name: 'bar'
          }
        ],
        [
          {
            name: 'foo'
          }
        ]
      ]
    );

    expect(result).to.eql({
      contains: {
        properties: {
          name: {
            type: 'string',
            minLength: 2,
            pattern: 'bar'
          }
        }
      },
      allOf: [
        {
          contains: {
            properties: {
              name: {
                type: 'string',
                minLength: 1,
                pattern: 'foo'
              }
            }
          }
        }
      ]
    });
  });

  it('merges valid subschemas inside a contains', async () => {
    const result = mergeAndTest(
      {
        contains: {
          minLength: 2
        },
        allOf: [
          {
            contains: {
              maxLength: 10,
              allOf: [
                {
                  maxLength: 8
                }
              ]
            }
          }
        ]
      },
      null,
      [['abc'], ['abc'], ['abc', 'de'], ['a'], ['abcdefgfdsafds']]
    );

    expect(result).to.eql({
      contains: {
        minLength: 2
      },
      allOf: [
        {
          contains: {
            maxLength: 8
          }
        }
      ]
    });
  });

  it('does not combine with base schema', async () => {
    const result = mergeAndTest(
      {
        contains: {
          minLength: 2
        },
        allOf: [
          {
            contains: {
              minLength: 3
            }
          },
          {
            contains: {
              maxLength: 10
            }
          }
        ]
      },
      null,
      [['abc'], ['abc'], ['abc', 'de'], ['a'], ['abcdefgfdsafds']]
    );

    expect(result).to.eql({
      contains: {
        minLength: 2
      },
      allOf: [
        {
          contains: {
            minLength: 3
          }
        },
        {
          contains: {
            maxLength: 10
          }
        }
      ]
    });
  });
});
