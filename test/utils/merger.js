import mergerModule from '../../src';
import Ajv from 'ajv';

const ajv = new Ajv({ strict: false });

export function merger(schema, options, instance) {
  const result = mergerModule(schema, options);
  const firstSchemaResult = ajv.validate(schema, instance);
  const alteredSchemaResult = ajv.validate(result, instance);

  if (firstSchemaResult !== alteredSchemaResult) {
    throw new Error(
      'Schema returned by merger does not validate same as original schema.'
    );
  }

  try {
    if (!ajv.validateSchema(result)) {
      throw new Error("Schema returned by resolver isn't valid.");
    }
    return result;
  } catch (e) {
    if (!/stack/i.test(e.message)) {
      throw e;
    }
  }
}

// all different json instances that should be tested against the schema before and after merge
// it does not matter if they do not apply to all schemas, since we only check for that the result
// validates the same as the original schema, either true or false
const baseInstances = [
  { '000': true },
  {
    '000': 'abcdefghi'
  },
  ['abc'],
  ['abc'],
  ['abc', 'de'],
  ['a'],
  ['abcdefgfdsafds'],
  'fdsafabba',
  'fdsaf',
  'abba',
  'fdfdsf',
  'abbafdsaf',
  'fdsafabba',
  1,
  2,
  3,
  4,
  5,
  6,
  1.1,
  1.2,
  9.9,
  60,
  21,
  10,
  [],
  {},
  '',
  null,
  [1],
  [1, 1],
  ['string', {}],
  { def: 'abc' },
  { abc: 'fds', prop4: true, bar: { abc: true, prop4: true } },
  { name: 'test', added: 123 },
  { name: 'test', added: false },
  { foo: null },
  { 123: true, abc: 2 },
  { list: [{ test: 1 }] },
  { list: [{ notAllowed: 1 }] },
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
];

export function mergeAndTest(schema, options, extraInstances) {
  const instances = baseInstances.concat(extraInstances ?? []);
  if (!instances?.length) throw new Error('No instances provided for testing.');

  const mergedSchema = mergerModule(schema, options);

  const validationResults = instances.map((instance) => {
    const originalSchemaValidationResult = ajv.validate(schema, instance);
    const originalErrors = ajv.errors;
    const mergedSchemaValidationResult = ajv.validate(mergedSchema, instance);
    const mergedErrors = ajv.errors;
    return {
      originalSchema: schema,
      originalErrors,
      mergedSchema,
      mergedErrors,
      instance,
      isDifferent:
        mergedSchemaValidationResult !== originalSchemaValidationResult,
      mergedSchemaValidationResult,
      originalSchemaValidationResult
    };
  });

  const allDiffs = validationResults.filter((result) => result.isDifferent);

  const hasPositive = validationResults.some(
    (result) => result.originalSchemaValidationResult
  );
  const hasNegative = validationResults.some(
    (result) => !result.originalSchemaValidationResult
  );

  if (validationResults.length && !(hasPositive && hasNegative)) {
    throw new Error('Test data must have both positive and negative cases.');
  }

  if (allDiffs.length) {
    const message = allDiffs.map((result) => {
      return (
        `Data: ${JSON.stringify(result.instance)}\n` +
        `Original valid:  ${result.originalSchemaValidationResult}\n` +
        `Merged valid:    ${result.mergedSchemaValidationResult}\n` +
        `Original schema: ${JSON.stringify(schema)}\n` +
        `Merged schema:   ${JSON.stringify(result.mergedSchema)}`
      );
    });

    throw new Error(
      `Some test data validates differently after the merge.\n` +
        message.join('\n')
    );
  }

  try {
    if (!ajv.validateSchema(mergedSchema)) {
      throw new Error("Schema returned by resolver isn't valid.");
    }
    return mergedSchema;
  } catch (e) {
    if (!/stack/i.test(e.message)) {
      throw e;
    }
  }
}

export function testEqualValidation(instance, schemas) {
  const firstSchemaResult = ajv.validate(schemas[0], instance);
  const allEqual = schemas
    .slice(1)
    .filter((schema) => ajv.validate(schema, instance) === firstSchemaResult);

  if (!allEqual) {
    throw new Error('Schemas do not validate equally.');
  }
}
