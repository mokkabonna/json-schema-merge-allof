import { describe, it, expect } from 'vitest';
import { mergeAndTest } from '../utils/merger.js';

describe('pattern', function () {
  it('does not merge pattern as it is not possible', function () {
    const result = mergeAndTest(
      {
        allOf: [
          {},
          {
            pattern: 'fdsaf'
          },
          {
            pattern: 'abba'
          }
        ]
      },
      null,
      ['fdsafabba', 'fdsaf', 'abba', 'fdfdsf', 'abbafdsaf', 'fdsafabba']
    );

    expect(result).toEqual({
      pattern: 'fdsaf',
      allOf: [
        {
          pattern: 'abba'
        }
      ]
    });

    const result2 = mergeAndTest({
      allOf: [
        {
          pattern: 'abba'
        }
      ]
    });

    expect(result2).to.eql({
      pattern: 'abba'
    });
  });
});
