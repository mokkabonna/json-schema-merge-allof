'use strict';

const mergeOld = require('json-schema-merge-allof-old');
const mergeNew = require('.');
const { inspect } = require('util');
const { sizeof } = require('sizeof');
const { cloneDeep } = require('lodash');

const schema = {
  allOf: [
    {
      anyOf: [
        { type: 'object', properties: { foo: { type: 'string' } } },
        { type: 'object', properties: { bar: { type: 'string' } } }
      ]
    },
    {
      allOf: [
        { type: 'object', properties: { one: { type: 'string' } } },
        { type: 'object', properties: { two: { type: 'string' } } }
      ]
    }
  ]
};

const m = mergeNew(schema);
const n = [m, m, m.anyOf, m.anyOf];
console.log(sizeof(m), sizeof(n), sizeof([mergeNew(schema), mergeNew(schema)]));
const mergedNew = [mergeNew(schema), mergeNew(schema), mergeNew(schema)];
const mergedOld = [
  mergeOld(cloneDeep(schema)),
  mergeOld(cloneDeep(schema)),
  mergeOld(cloneDeep(schema))
];

console.log(inspect(mergedNew));

console.log('Old:', sizeof(mergedOld));
console.log('New:', sizeof(mergedNew));
