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

export function mergeAndTest(schema, options, instances) {
  if (!instances?.length) throw new Error('No instances provided for testing.');

  const mergedSchema = mergerModule(schema, options);

  const validationResults = instances.map((instance) => {
    const mergedSchemaValidationResult = ajv.validate(mergedSchema, instance);
    const originalSchemaValidationResult = ajv.validate(schema, instance);
    return {
      mergedSchema,
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
