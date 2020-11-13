export const propertyRelated = [
  'properties',
  'patternProperties',
  'additionalProperties'
] as const;

export const itemsRelated = ['items', 'additionalItems'] as const;

export const schemaGroupProps = [
  'properties',
  'patternProperties',
  'definitions',
  'dependencies'
] as const;

export const schemaArrays = ['anyOf', 'oneOf'] as const;

export const schemaProps = [
  'additionalProperties',
  'additionalItems',
  'contains',
  'propertyNames',
  'not',
  'items'
] as const;
