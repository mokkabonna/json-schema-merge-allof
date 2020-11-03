import type { JSONSchema4, JSONSchema6, JSONSchema7 } from 'json-schema';
import type { DeepReadonly } from 'ts-essentials';
import compare from 'json-schema-compare';
import computeLcm from 'compute-lcm';
import {
  defaultsDeep,
  forEach,
  intersection,
  intersectionWith,
  isEqual,
  isPlainObject,
  pullAll,
  sortBy
} from 'lodash';

import type { MergeSchemas, Resolvers } from './types';
import {
  allUniqueKeys,
  contains,
  examples,
  first,
  flatten,
  flattenDeep,
  isEmptySchema,
  isFalse,
  isItemsRelated,
  isPropertyRelated,
  isSchema,
  isTrue,
  keys,
  maximumValue,
  minimumValue,
  notUndefined,
  required,
  schemaResolver,
  stringArray,
  uniq,
  uniqueItems,
  uniqWith,
  withoutArr
} from './util';
import {
  propertyRelated,
  itemsRelated,
  schemaArrays,
  schemaGroupProps,
  schemaProps
} from './constants';

type JSONSchema = JSONSchema4 | JSONSchema6 | JSONSchema7;
type JSONSchema46 = JSONSchema4 | JSONSchema6;

const hasOwnProperty = Object.prototype.hasOwnProperty;

function compareProp(key) {
  return function (a, b) {
    return compare(
      {
        [key]: a
      },
      { [key]: b }
    );
  };
}

function getAllOf(schema) {
  // eslint-disable-next-line prefer-const
  let { allOf = [], ...copy } = schema;
  copy = isPlainObject(schema) ? copy : schema; // if schema is boolean
  return [copy, ...allOf.map(getAllOf)];
}

function getValues(schemas, key) {
  return schemas.map((schema) => schema && schema[key]);
}

function getItemSchemas(subSchemas, key) {
  return subSchemas.map(function (sub) {
    if (!sub) {
      return;
    }

    if (Array.isArray(sub.items)) {
      const schemaAtPos = sub.items[key];
      if (isSchema(schemaAtPos)) {
        return schemaAtPos;
      } else if (hasOwnProperty.call(sub, 'additionalItems')) {
        return sub.additionalItems;
      }
    } else {
      return sub.items;
    }
  });
}

function tryMergeSchemaGroups(schemaGroups, mergeSchemas) {
  return schemaGroups
    .map(function (schemas, index) {
      try {
        return mergeSchemas(schemas, index);
      } catch (e) {
        return undefined;
      }
    })
    .filter(notUndefined);
}

function getAdditionalSchemas(subSchemas) {
  return subSchemas.map(function (sub) {
    if (!sub) {
      return;
    }
    if (Array.isArray(sub.items)) {
      return sub.additionalItems;
    }
    return sub.items;
  });
}

function getAnyOfCombinations<T extends JSONSchema>(
  arrOfArrays: DeepReadonly<T[][]>,
  combinations?: DeepReadonly<T[][]>
) {
  combinations = combinations || [];
  if (!arrOfArrays.length) {
    return combinations;
  }

  const values = arrOfArrays.slice(0).shift();
  const rest = arrOfArrays.slice(1);
  if (combinations.length) {
    return getAnyOfCombinations(
      rest,
      flatten(
        combinations.map((combination) =>
          values.map((item) => [item].concat(combination))
        )
      )
    );
  }
  return getAnyOfCombinations(
    rest,
    // @ts-ignore
    values.map((item) => item)
  );
}

function mergeWithArray(base, newItems) {
  if (Array.isArray(base)) {
    base.splice.apply(base, [0, 0].concat(newItems));
    return base;
  } else {
    return newItems;
  }
}

function throwIncompatible(values, paths) {
  let asJSON;
  try {
    asJSON = values
      .map(function (val) {
        return JSON.stringify(val, null, 2);
      })
      .join('\n');
  } catch (variable) {
    asJSON = values.join(', ');
  }
  throw new Error(
    'Could not resolve values for path:"' +
      paths.join('.') +
      '". They are probably incompatible. Values: \n' +
      asJSON
  );
}

function cleanupReturnValue(returnObject) {
  // cleanup empty
  for (const prop in returnObject) {
    if (
      hasOwnProperty.call(returnObject, prop) &&
      isEmptySchema(returnObject[prop])
    ) {
      const { [prop]: dummy, ...rest } = returnObject;
      returnObject = rest;
    }
  }
  return returnObject;
}

function createRequiredSubMerger(mergeSchemas, key, parents) {
  return function (schemas, subKey) {
    if (subKey === undefined) {
      throw new Error(
        'You need to call merger with a key for the property name or index if array.'
      );
    }
    subKey = String(subKey);
    return mergeSchemas(schemas, null, parents.concat(key, subKey));
  };
}

function callGroupResolver(
  keys,
  resolverName,
  schemas,
  mergeSchemas,
  options,
  parents
) {
  if (keys.length) {
    const resolver = options.resolvers[resolverName];
    if (!resolver) {
      throw new Error('No resolver found for ' + resolverName);
    }

    let compacted = uniqWith(
      schemas
        .map(function (schema) {
          return keys.reduce(function (all, key) {
            if (schema[key] !== undefined) {
              all = setProp(all, key, schema[key]);
            }
            return all;
          }, {});
        })
        .filter(notUndefined),
      compare
    );
    if (isEqual(compacted, schemas)) compacted = schemas;

    const related =
      resolverName === 'properties' ? propertyRelated : itemsRelated;

    // TODO: Remove "any"
    const mergers: any = (related as any).reduce(function (all, key) {
      if (contains(schemaGroupProps, key)) {
        all = setProp(
          all,
          key,
          createRequiredSubMerger(mergeSchemas, key, parents)
        );
      } else {
        all = setProp(all, key, function (schemas) {
          return mergeSchemas(schemas, null, parents.concat(key));
        });
      }
      return all;
    }, {});

    if (resolverName === 'items') {
      mergers.itemsArray = createRequiredSubMerger(
        mergeSchemas,
        'items',
        parents
      );
      mergers.items = function (schemas) {
        return mergeSchemas(schemas, null, parents.concat('items'));
      };
    }

    let result = resolver(
      compacted,
      parents.concat(resolverName),
      mergers,
      options
    );

    if (!isPlainObject(result)) {
      throwIncompatible(compacted, parents.concat(resolverName));
    }

    result = cleanupReturnValue(result);
    if (Object.keys(result).length === 1) {
      if (
        'properties' in result &&
        isEqual(result.properties, schemas[0].properties)
      ) {
        return { properties: schemas[0].properties };
      } else if ('items' in result && isEqual(result.items, schemas[0].items)) {
        return { items: schemas[0].items };
      }
    }
    return result;
  }
}

// Provide source when array
function mergeSchemaGroup(group, mergeSchemas, source?: JSONSchema[]) {
  const allKeys = allUniqueKeys(source || group);
  const extractor = source ? getItemSchemas : getValues;
  return allKeys.reduce(
    function (all, key) {
      const schemas = extractor(group, key);
      const compacted = uniqWith(schemas.filter(notUndefined), compare);
      return setProp(all, key, mergeSchemas(compacted, key));
    },
    source ? [] : {}
  );
}

function removeFalseSchemas(target) {
  let changed = false;
  const copy = { ...target };
  forEach(copy, function (schema, prop) {
    if (schema === false) {
      changed = true;
      delete copy[prop];
    }
  });
  return changed ? copy : target;
}

function removeFalseSchemasFromArray(target) {
  return target.filter((s) => s !== false);
}

function createRequiredMetaArray(arr) {
  return { required: arr };
}

const defaultResolvers: Resolvers<JSONSchema> = {
  type(compacted) {
    if (compacted.some(Array.isArray)) {
      const normalized = compacted.map(function (val) {
        return Array.isArray(val) ? val : [val];
      });
      const common = intersection.apply(null, normalized);

      if (common.length === 1) {
        return common[0];
      } else if (common.length > 1) {
        return uniq(common);
      }
    }
  },
  properties(values, key, mergers, options) {
    // first get rid of all non permitted properties
    if (!options.ignoreAdditionalProperties) {
      values = [...values];
      values.forEach(function (subSchema) {
        const ownKeys = keys(subSchema.properties);
        const ownPatternKeys = keys(subSchema.patternProperties);
        const ownPatterns = ownPatternKeys.map((k) => new RegExp(k as string));

        values.forEach(function (other, idx) {
          if (other === subSchema) {
            return;
          }

          const allOtherKeys = keys(other.properties);
          const keysMatchingPattern = allOtherKeys.filter((k) =>
            // @ts-ignore
            ownPatterns.some((pk) => pk.test(k))
          );
          const additionalKeys = withoutArr(
            allOtherKeys,
            ownKeys,
            keysMatchingPattern
          );

          let otherProps = other.properties;
          additionalKeys.forEach(function (key) {
            otherProps = setProp(
              otherProps,
              key,
              mergers.properties(
                // @ts-ignore
                [otherProps[key], subSchema.additionalProperties],
                key
              )
            );
          });
          values[idx] = setProp(other, 'properties', otherProps);
        });
      });

      // remove disallowed patternProperties
      values.forEach(function (subSchema) {
        const ownPatternKeys = keys(subSchema.patternProperties);
        if (subSchema.additionalProperties === false) {
          values.forEach(function (other, idx) {
            if (other === subSchema) {
              return;
            }

            const allOtherPatterns = keys(other.patternProperties);
            const additionalPatternKeys = withoutArr(
              allOtherPatterns,
              ownPatternKeys
            );
            let otherPatternProps = other.patternProperties;
            additionalPatternKeys.forEach((key) => {
              const { [key]: dummy, ...rest } = otherPatternProps;
              otherPatternProps = rest;
            });
            values[idx] = setProp(
              other,
              'patternProperties',
              otherPatternProps
            );
          });
        }
      });
    }

    let returnObject = {
      additionalProperties: mergers.additionalProperties(
        // @ts-ignore
        values.map((s) => s.additionalProperties)
      ),
      patternProperties: mergeSchemaGroup(
        values.map((s) => s.patternProperties),
        mergers.patternProperties
      ),
      properties: mergeSchemaGroup(
        values.map((s) => s.properties),
        mergers.properties
      )
    };

    if (returnObject.additionalProperties === false) {
      returnObject = setProp(
        returnObject,
        'properties',
        removeFalseSchemas(returnObject.properties)
      );
    }

    return returnObject;
  },
  dependencies(compacted, paths, mergeSchemas) {
    const allChildren = allUniqueKeys(compacted);

    return allChildren.reduce(function (all, childKey) {
      const childSchemas = getValues(compacted, childKey);
      let innerCompacted = uniqWith(childSchemas.filter(notUndefined), isEqual);

      // to support dependencies
      const innerArrays = innerCompacted.filter(Array.isArray);

      if (innerArrays.length) {
        if (innerArrays.length === innerCompacted.length) {
          all[childKey] = stringArray(innerCompacted);
        } else {
          const innerSchemas = innerCompacted.filter(isSchema);
          const arrayMetaScheams = innerArrays.map(createRequiredMetaArray);
          all[childKey] = mergeSchemas(
            innerSchemas.concat(arrayMetaScheams),
            // @ts-ignore
            childKey
          );
        }
        return all;
      }

      innerCompacted = uniqWith(innerCompacted, compare);

      // @ts-ignore
      all[childKey] = mergeSchemas(innerCompacted, childKey);
      return all;
    }, {});
  },
  items(values, paths, mergers) {
    const items = values.map((s) => (s as JSONSchema).items);
    const itemsCompacted = items.filter(notUndefined);

    let returnObject: JSONSchema = {};
    if (itemsCompacted.every(isSchema)) {
      returnObject.items = (mergers as any).items(items);
    } else {
      returnObject.items = mergeSchemaGroup(
        values,
        (mergers as any).itemsArray,
        // @ts-ignore
        items
      );
    }

    let schemasAtLastPos;
    if (itemsCompacted.every(Array.isArray)) {
      schemasAtLastPos = values.map((s) => (s as JSONSchema).additionalItems);
    } else if (itemsCompacted.some(Array.isArray)) {
      schemasAtLastPos = getAdditionalSchemas(values);
    }

    if (schemasAtLastPos) {
      // @ts-ignore
      returnObject.additionalItems = mergers.additionalItems(schemasAtLastPos);
    }

    if (
      returnObject.additionalItems === false &&
      Array.isArray(returnObject.items)
    ) {
      returnObject = setProp(
        returnObject,
        'items',
        removeFalseSchemasFromArray(returnObject.items)
      );
    }

    return returnObject;
  },
  // @ts-ignore
  oneOf(compacted, paths, mergeSchemas) {
    // @ts-ignore
    const combinations = getAnyOfCombinations(compacted);
    const result = tryMergeSchemaGroups(combinations, mergeSchemas);
    const unique = uniqWith(result, compare);

    if (unique.length) {
      return unique;
    }
  },
  // @ts-ignore
  not(compacted) {
    return { anyOf: compacted };
  },
  pattern(compacted) {
    return compacted.map((r) => '(?=' + r + ')').join('');
  },
  multipleOf(compacted: number[]): number {
    let integers = compacted.slice(0);
    let factor = 1;
    while (integers.some((n) => !Number.isInteger(n))) {
      integers = integers.map((n) => n * 10);
      factor = factor * 10;
    }
    return computeLcm(integers) / factor;
  },
  enum(compacted) {
    // @ts-ignore
    const enums = intersectionWith.apply(null, compacted.concat(isEqual));
    if (enums.length) {
      return sortBy(enums);
    }
  },
  $id: first,
  $ref: first,
  $schema: first,
  additionalItems: schemaResolver,
  additionalProperties: schemaResolver,
  anyOf: (...args) => defaultResolvers.oneOf(...args),
  contains: schemaResolver,
  default: first,
  // @ts-ignore TS2322
  definitions: (...args) => defaultResolvers.dependencies(...args),
  description: first,
  examples: examples,
  exclusiveMaximum: minimumValue,
  exclusiveMinimum: maximumValue,
  maximum: minimumValue,
  maxItems: minimumValue,
  maxLength: minimumValue,
  maxProperties: minimumValue,
  minimum: maximumValue,
  minItems: maximumValue,
  minLength: maximumValue,
  minProperties: maximumValue,
  propertyNames: schemaResolver,
  // @ts-ignore TS2322
  required,
  title: first,
  uniqueItems: uniqueItems
};

interface Options<Schema extends JSONSchema = JSONSchema> {
  ignoreErrors?: boolean;
  /**
   * **ignoreAdditionalProperties** default **false**
   *
   * Allows you to combine schema properties even though some schemas have
   * `additionalProperties: false` This is the most common issue people face
   * when trying to expand schemas using allOf and a limitation of the json
   * schema spec. Be aware though that the schema produced will allow more than
   * the original schema. But this is useful if just want to combine schemas
   * using allOf as if additionalProperties wasn't false during the merge
   * process. The resulting schema will still get additionalProperties set to
   * false.
   */
  ignoreAdditionalProperties?: boolean;
  /**
   * **resolvers** Object
   *
   * Override any default resolver like this:
   *
   * ```js mergeAllOf(schema, { resolvers: {
   *     title: function(values, path, mergeSchemas, options) {
   *     // choose what title you want to be used based on the conflicting values
   *     // resolvers MUST return a value other than undefined
   *     } } }) ```
   *
   * The function is passed:
   *
   * - **values** an array of the conflicting values that need to be resolved -
   * **path** an array of strings containing the path to the position in the
   * schema that caused the resolver to be called (useful if you use the same
   * resolver for multiple keywords, or want to implement specific logic for
   * custom paths) - **mergeSchemas** a function you can call that merges an
   * array of schemas - **options** the options mergeAllOf was called with
   */
  resolvers?: Partial<Resolvers<Schema>> & {
    /**
     * ### Default resolver You can set a default resolver that catches any
     * unknown keyword. Let's say you want to use the same strategy as the ones
     * for the meta keywords, to use the first value found. You can accomplish
     * that like this:
     *
     * ```js mergeJsonSchema({ ... }, { resolvers: {
     *     defaultResolver: mergeJsonSchema.options.resolvers.title } }) ```
     */
    defaultResolver?(
      values: any[],
      path: string[],
      mergeSchemas: MergeSchemas,
      options: Options<Schema>
    ): any;
  };
}

// @ts-ignore TS2394
function merger<T extends JSONSchema>(
  rootSchema: T,
  options: Options<T> & { ignoreAdditionalProperties: true }
): T;
function merger(
  rootSchema: JSONSchema4,
  options?: Options<JSONSchema4>
): JSONSchema4;
function merger(
  rootSchema: JSONSchema6,
  options?: Options<JSONSchema6>
): JSONSchema6;
function merger(
  rootSchema: JSONSchema7,
  options?: Options<JSONSchema7>
): JSONSchema7;
function merger(
  rootSchema: JSONSchema46,
  options?: Options<JSONSchema46>
): JSONSchema46;
function merger(rootSchema: JSONSchema, options?: Options): JSONSchema;

function merger<T extends JSONSchema>(
  rootSchema: DeepReadonly<T>,
  options,
  totalSchemas
) {
  totalSchemas = totalSchemas || [];
  options = defaultsDeep(options, {
    ignoreAdditionalProperties: false,
    resolvers: defaultResolvers,
    deep: true
  });

  function mergeSchemas<T extends JSONSchema>(
    schemas: DeepReadonly<T>[],
    base?: DeepReadonly<T> | null | undefined,
    parents?: Array<keyof T | keyof DeepReadonly<T>>
  ) {
    schemas = schemas.filter(notUndefined);
    parents = parents || [];
    let merged: DeepReadonly<T> = isPlainObject(base)
      ? (base as DeepReadonly<T>)
      : ({} as DeepReadonly<T>);

    // return undefined, an empty schema
    if (!schemas.length) {
      return;
    }

    if (schemas.some(isFalse)) {
      return false;
    }

    if (schemas.every(isTrue)) {
      return true;
    }

    // there are no false and we don't need the true ones as they accept everything
    schemas = schemas.filter(isPlainObject);

    const allKeys: Array<keyof DeepReadonly<T>> = allUniqueKeys(schemas);
    if (options.deep && contains(allKeys, 'allOf')) {
      return merger(
        { allOf: schemas },
        options,
        // @ts-ignore TS2552
        totalSchemas
      );
    }

    const propertyKeys = allKeys.filter(isPropertyRelated);
    pullAll(allKeys, propertyKeys);

    const itemKeys = allKeys.filter(isItemsRelated);
    pullAll(allKeys, itemKeys);

    allKeys.forEach(function (key) {
      const values = getValues(schemas, key);
      const compacted = uniqWith(values.filter(notUndefined), compareProp(key));

      // arrayprops like anyOf and oneOf must be merged first, as they contains schemas
      // allOf is treated differently alltogether
      if (compacted.length === 1 && contains(schemaArrays, key)) {
        merged = setProp(
          merged,
          key,
          compacted[0].map(function (schema) {
            return mergeSchemas([schema], schema);
          })
        );
        // prop groups must always be resolved
      } else if (
        compacted.length === 1 &&
        !contains(schemaGroupProps, key) &&
        !contains(schemaProps, key)
      ) {
        merged = setProp(merged, key, compacted[0]);
      } else {
        const resolver =
          options.resolvers[key] || options.resolvers.defaultResolver;

        if (!resolver) {
          throw new Error(
            'No resolver found for key ' +
              key +
              '. You can provide a resolver for this keyword in the options, or provide a default resolver.'
          );
        }

        let merger;
        // get custom merger for groups
        if (contains(schemaGroupProps, key) || contains(schemaArrays, key)) {
          merger = createRequiredSubMerger(mergeSchemas, key, parents);
        } else {
          merger = function (schemas) {
            return mergeSchemas(schemas, null, parents.concat(key));
          };
        }

        let calledWithArray = false;
        merged = setProp(
          merged,
          key,
          resolver(compacted, parents.concat(key), merger, options, function (
            unresolvedSchemas
          ) {
            calledWithArray = Array.isArray(unresolvedSchemas);
            return addToAllOf(unresolvedSchemas);
          })
        );

        if (merged[key] === undefined && !calledWithArray) {
          throwIncompatible(compacted, parents.concat(key));
        } else if (merged[key] === undefined) {
          const { [key]: dummy, ...rest } = merged;
          merged = rest as DeepReadonly<T>;
        }
      }
    });

    merged = setProps(
      merged,
      callGroupResolver(
        propertyKeys,
        'properties',
        schemas,
        mergeSchemas,
        options,
        parents
      )
    );
    merged = setProps(
      merged,
      callGroupResolver(
        itemKeys,
        'items',
        schemas,
        mergeSchemas,
        options,
        parents
      )
    );

    function addToAllOf(unresolvedSchemas) {
      const mergedAllOf = mergeWithArray(merged.allOf, unresolvedSchemas);
      if (mergedAllOf !== merged.allOf) {
        merged = {
          ...merged,
          allOf: mergeWithArray(merged.allOf, unresolvedSchemas)
        };
      }
    }

    return merged;
  }

  const allSchemas = flattenDeep(getAllOf(rootSchema));
  const merged = mergeSchemas(allSchemas);

  return merged;
}

merger.options = {
  resolvers: defaultResolvers
};

function setProp<T>(ob, key, value): T {
  if (ob[key] !== value) {
    if (Array.isArray(ob)) {
      ob = ob.slice();
      ob[key] = value;
    } else {
      ob = { ...ob, [key]: value };
    }
  }
  return ob;
}

function setProps<T>(ob, values): T {
  for (const k in values) {
    const val = values[k];
    if (val !== ob[k]) ob = setProp(ob, k, val);
  }
  return ob;
}

export = (process.env.NODE_ENV === 'test'
  ? (...args) => {
      // In test mode, *make sure* we do not accidentally mutate anything
      const deepFreeze = require('deep-freeze');
      const [rootSchema, ...rest] = args;
      return merger(deepFreeze(rootSchema), ...rest);
    }
  : merger) as typeof merger;
