import { beforeEach, describe, it } from 'vitest';
import { expect } from 'chai';
import merger from '../../src';
import { cloneDeep } from 'lodash';
import { dereference } from 'json-schema-ref-parser';
import metaSchema from '../fixtures/schemas/meta-schema-v6.json';

let schema;
describe.skip('simplify the meta schema', function () {
  beforeEach(function () {
    return dereference(cloneDeep(metaSchema)).then(function (dereferenced) {
      schema = dereferenced;
    });
  });

  it('simplifies', function () {
    const result = merger(cloneDeep(schema));
    expect(result).to.eql(schema);
  });
});
