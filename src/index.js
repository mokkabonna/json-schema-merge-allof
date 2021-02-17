const cloneDeep = require('lodash/cloneDeep')
const compare = require('json-schema-compare')
const computeLcm = require('compute-lcm')
const defaultsDeep = require('lodash/defaultsDeep')
const flatten = require('lodash/flatten')
const flattenDeep = require('lodash/flattenDeep')
const intersection = require('lodash/intersection')
const intersectionWith = require('lodash/intersectionWith')
const isEqual = require('lodash/isEqual')
const isPlainObject = require('lodash/isPlainObject')
const pullAll = require('lodash/pullAll')
const sortBy = require('lodash/sortBy')
const forEach = require('lodash/forEach')
const uniq = require('lodash/uniq')
const uniqWith = require('lodash/uniqWith')
const without = require('lodash/without')

const has = (obj, propName) => Object.prototype.hasOwnProperty.call(obj, propName)
const withoutArr = (arr, ...rest) => without.apply(null, [arr].concat(flatten(rest)))
const isPropertyRelated = (key) => contains(propertyRelated, key)
const isItemsRelated = (key) => contains(itemsRelated, key)
const isConditionalRelated = (key) => contains(conditonalRelated, key)
const contains = (arr, val) => arr.indexOf(val) !== -1
const isEmptySchema = (obj) => (!keys(obj).length) && obj !== false && obj !== true
const isSchema = (val) => isPlainObject(val) || val === true || val === false
const isFalse = (val) => val === false
const isTrue = (val) => val === true
const schemaResolver = (compacted, key, mergeSchemas) => mergeSchemas(compacted)
const stringArray = (values) => sortBy(uniq(flattenDeep(values)))
const notUndefined = (val) => val !== undefined
const allUniqueKeys = (arr) => uniq(flattenDeep(arr.map(keys)))

// resolvers
const first = compacted => compacted[0]
const required = compacted => stringArray(compacted)
const maximumValue = compacted => Math.max.apply(Math, compacted)
const minimumValue = compacted => Math.min.apply(Math, compacted)
const uniqueItems = compacted => compacted.some(isTrue)
const examples = compacted => uniqWith(flatten(compacted), isEqual)

function compareProp(key) {
  return function(a, b) {
    return compare({
      [key]: a
    }, { [key]: b })
  }
}

function getAllOf(schema) {
  let { allOf = [], ...copy } = schema
  copy = isPlainObject(schema) ? copy : schema // if schema is boolean
  return [copy, ...allOf.map(getAllOf)]
}

function getValues(schemas, key) {
  return schemas.map(schema => schema && schema[key])
}

function getItemSchemas(subSchemas, key) {
  return subSchemas.map(function(sub) {
    if (!sub) {
      return undefined
    }

    if (Array.isArray(sub.items)) {
      const schemaAtPos = sub.items[key]
      if (isSchema(schemaAtPos)) {
        return schemaAtPos
      } else if (has(sub, 'additionalItems')) {
        return sub.additionalItems
      }
    } else {
      return sub.items
    }

    return undefined
  })
}

function tryMergeSchemaGroups(schemaGroups, mergeSchemas) {
  return schemaGroups.map(function(schemas, index) {
    try {
      return mergeSchemas(schemas, index)
    } catch (e) {
      return undefined
    }
  }).filter(notUndefined)
}

function getAdditionalSchemas(subSchemas) {
  return subSchemas.map(function(sub) {
    if (!sub) {
      return undefined
    }
    if (Array.isArray(sub.items)) {
      return sub.additionalItems
    }
    return sub.items
  })
}

function keys(obj) {
  if (isPlainObject(obj) || Array.isArray(obj)) {
    return Object.keys(obj)
  } else {
    return []
  }
}

function getAnyOfCombinations(arrOfArrays, combinations) {
  combinations = combinations || []
  if (!arrOfArrays.length) {
    return combinations
  }

  const values = arrOfArrays.slice(0).shift()
  const rest = arrOfArrays.slice(1)
  if (combinations.length) {
    return getAnyOfCombinations(rest, flatten(combinations.map(combination => values.map(item => ([item].concat(combination))))))
  }
  return getAnyOfCombinations(rest, values.map(item => (item)))
}

function mergeWithArray(base, newItems) {
  if (Array.isArray(base)) {
    base.splice.apply(base, [0, 0].concat(newItems))
    return base
  } else {
    return newItems
  }
}

function throwIncompatible(values, paths) {
  let asJSON
  try {
    asJSON = values.map(function(val) {
      return JSON.stringify(val, null, 2)
    }).join('\n')
  } catch (variable) {
    asJSON = values.join(', ')
  }
  throw new Error('Could not resolve values for path:"' + paths.join('.') + '". They are probably incompatible. Values: \n' + asJSON)
}

function cleanupReturnValue(returnObject) {
  // cleanup empty
  for (const prop in returnObject) {
    if (has(returnObject, prop) && isEmptySchema(returnObject[prop])) {
      delete returnObject[prop]
    }
  }
  return returnObject
}

function createRequiredSubMerger(mergeSchemas, key, parents) {
  return function(schemas, subKey) {
    if (subKey === undefined) {
      throw new Error('You need to call merger with a key for the property name or index if array.')
    }
    subKey = String(subKey)
    return mergeSchemas(schemas, null, parents.concat(key, subKey))
  }
}

function callGroupResolver(keys, resolverName, schemas, mergeSchemas, options, parents) {
  if (keys.length) {
    const resolver = options.resolvers[resolverName]
    if (!resolver) {
      throw new Error('No resolver found for ' + resolverName)
    }

    const compacted = uniqWith(schemas.map(function(schema) {
      return keys.reduce(function(all, key) {
        if (schema[key] !== undefined) {
          all[key] = schema[key]
        }
        return all
      }, {})
    }).filter(notUndefined), compare)

    const map = {
      properties: propertyRelated,
      items: itemsRelated,
      if: conditonalRelated
    }

    const isIf = resolverName === 'if'
    const related = map[resolverName]

    const mergers = related.reduce(function(all, key) {
      if (contains(schemaGroupProps, key)) {
        all[key] = createRequiredSubMerger(mergeSchemas, key, parents)
      } else {
        all[key] = function(schemas) {
          return mergeSchemas(schemas, null, parents.concat(key))
        }
      }
      return all
    }, {})

    if (resolverName === 'items') {
      mergers.itemsArray = createRequiredSubMerger(mergeSchemas, 'items', parents)
      mergers.items = function(schemas) {
        return mergeSchemas(schemas, null, parents.concat('items'))
      }
    }

    const result = resolver(compacted, parents.concat(resolverName), mergers, options)

    if (!isPlainObject(result)) {
      throwIncompatible(compacted, parents.concat(resolverName))
    }

    if (isIf) {
      return result
    } else {
      return cleanupReturnValue(result)
    }
  }
}

// Provide source when array
function mergeSchemaGroup(group, mergeSchemas, source) {
  const allKeys = allUniqueKeys(source || group)
  const extractor = source
    ? getItemSchemas
    : getValues
  return allKeys.reduce(function(all, key) {
    const schemas = extractor(group, key)
    const compacted = uniqWith(schemas.filter(notUndefined), compare)
    all[key] = mergeSchemas(compacted, key)
    return all
  }, source
    ? []
    : {})
}

function removeFalseSchemas(target) {
  forEach(target, function(schema, prop) {
    if (schema === false) {
      delete target[prop]
    }
  })
}

function removeFalseSchemasFromArray(target) {
  forEach(target, function(schema, index) {
    if (schema === false) {
      target.splice(index, 1)
    }
  })
}

function createRequiredMetaArray(arr) {
  return { required: arr }
}

const propertyRelated = ['properties', 'patternProperties', 'additionalProperties']
const itemsRelated = ['items', 'additionalItems']
const conditonalRelated = ['if', 'then', 'else']
const schemaGroupProps = ['properties', 'patternProperties', 'definitions', 'dependencies']
const schemaArrays = ['anyOf', 'oneOf']
const schemaProps = [
  'additionalProperties',
  'additionalItems',
  'contains',
  'propertyNames',
  'not',
  'items'
]

const defaultResolvers = {
  type(compacted) {
    if (compacted.some(Array.isArray)) {
      const normalized = compacted.map(function(val) {
        return Array.isArray(val)
          ? val
          : [val]
      })
      const common = intersection.apply(null, normalized)

      if (common.length === 1) {
        return common[0]
      } else if (common.length > 1) {
        return uniq(common)
      }
    }
  },
  properties(values, key, mergers, options) {
    // first get rid of all non permitted properties
    if (!options.ignoreAdditionalProperties) {
      values.forEach(function(subSchema) {
        const otherSubSchemas = values.filter(s => s !== subSchema)
        const ownKeys = keys(subSchema.properties)
        const ownPatternKeys = keys(subSchema.patternProperties)
        const ownPatterns = ownPatternKeys.map(k => new RegExp(k))
        otherSubSchemas.forEach(function(other) {
          const allOtherKeys = keys(other.properties)
          const keysMatchingPattern = allOtherKeys.filter(k => ownPatterns.some(pk => pk.test(k)))
          const additionalKeys = withoutArr(allOtherKeys, ownKeys, keysMatchingPattern)
          additionalKeys.forEach(function(key) {
            other.properties[key] = mergers.properties([
              other.properties[key], subSchema.additionalProperties
            ], key)
          })
        })
      })

      // remove disallowed patternProperties
      values.forEach(function(subSchema) {
        const otherSubSchemas = values.filter(s => s !== subSchema)
        const ownPatternKeys = keys(subSchema.patternProperties)
        if (subSchema.additionalProperties === false) {
          otherSubSchemas.forEach(function(other) {
            const allOtherPatterns = keys(other.patternProperties)
            const additionalPatternKeys = withoutArr(allOtherPatterns, ownPatternKeys)
            additionalPatternKeys.forEach(key => delete other.patternProperties[key])
          })
        }
      })
    }

    const returnObject = {
      additionalProperties: mergers.additionalProperties(values.map(s => s.additionalProperties)),
      patternProperties: mergeSchemaGroup(values.map(s => s.patternProperties), mergers.patternProperties),
      properties: mergeSchemaGroup(values.map(s => s.properties), mergers.properties)
    }

    if (returnObject.additionalProperties === false) {
      removeFalseSchemas(returnObject.properties)
    }

    return returnObject
  },
  dependencies(compacted, paths, mergeSchemas) {
    const allChildren = allUniqueKeys(compacted)

    return allChildren.reduce(function(all, childKey) {
      const childSchemas = getValues(compacted, childKey)
      let innerCompacted = uniqWith(childSchemas.filter(notUndefined), isEqual)

      // to support dependencies
      const innerArrays = innerCompacted.filter(Array.isArray)

      if (innerArrays.length) {
        if (innerArrays.length === innerCompacted.length) {
          all[childKey] = stringArray(innerCompacted)
        } else {
          const innerSchemas = innerCompacted.filter(isSchema)
          const arrayMetaScheams = innerArrays.map(createRequiredMetaArray)
          all[childKey] = mergeSchemas(innerSchemas.concat(arrayMetaScheams), childKey)
        }
        return all
      }

      innerCompacted = uniqWith(innerCompacted, compare)

      all[childKey] = mergeSchemas(innerCompacted, childKey)
      return all
    }, {})
  },
  items(values, paths, mergers) {
    const items = values.map(s => s.items)
    const itemsCompacted = items.filter(notUndefined)
    const returnObject = {}

    if (itemsCompacted.every(isSchema)) {
      returnObject.items = mergers.items(items)
    } else {
      returnObject.items = mergeSchemaGroup(values, mergers.itemsArray, items)
    }

    let schemasAtLastPos
    if (itemsCompacted.every(Array.isArray)) {
      schemasAtLastPos = values.map(s => s.additionalItems)
    } else if (itemsCompacted.some(Array.isArray)) {
      schemasAtLastPos = getAdditionalSchemas(values)
    }

    if (schemasAtLastPos) {
      returnObject.additionalItems = mergers.additionalItems(schemasAtLastPos)
    }

    if (returnObject.additionalItems === false && Array.isArray(returnObject.items)) {
      removeFalseSchemasFromArray(returnObject.items)
    }

    return returnObject
  },
  oneOf(compacted, paths, mergeSchemas) {
    const combinations = getAnyOfCombinations(cloneDeep(compacted))
    const result = tryMergeSchemaGroups(combinations, mergeSchemas)
    const unique = uniqWith(result, compare)

    if (unique.length) {
      return unique
    }
  },
  not(compacted) {
    return { anyOf: compacted }
  },
  pattern(compacted) {
    return compacted.map(r => '(?=' + r + ')').join('')
  },
  multipleOf(compacted) {
    let integers = compacted.slice(0)
    let factor = 1
    while (integers.some(n => !Number.isInteger(n))) {
      integers = integers.map(n => n * 10)
      factor = factor * 10
    }
    return computeLcm(integers) / factor
  },
  enum(compacted) {
    const enums = intersectionWith.apply(null, compacted.concat(isEqual))
    if (enums.length) {
      return sortBy(enums)
    }
  },
  if(values, props, mergers, options) {
    const allWithConditional = values.filter(schema =>
      conditonalRelated.some(keyword => has(schema, keyword)))

    // merge sub schemas completely
    // if,then,else must not be merged to the base schema, but if they contain allOf themselves, that should be merged
    function merge(schema) {
      const obj = {}
      if (has(schema, 'if')) obj.if = mergers.if([schema.if])
      if (has(schema, 'then')) obj.then = mergers.then([schema.then])
      if (has(schema, 'else')) obj.else = mergers.else([schema.else])
      return obj
    }

    // first schema with any of the 3 keywords is used as base
    const first = merge(allWithConditional.shift())
    return allWithConditional.reduce((all, schema) => {
      all.allOf = (all.allOf || []).concat(merge(schema))
      return all
    }, first)
  }
}

defaultResolvers.$id = first
defaultResolvers.$ref = first
defaultResolvers.$schema = first
defaultResolvers.additionalItems = schemaResolver
defaultResolvers.additionalProperties = schemaResolver
defaultResolvers.anyOf = defaultResolvers.oneOf
defaultResolvers.contains = schemaResolver
defaultResolvers.default = first
defaultResolvers.definitions = defaultResolvers.dependencies
defaultResolvers.description = first
defaultResolvers.examples = examples
defaultResolvers.exclusiveMaximum = minimumValue
defaultResolvers.exclusiveMinimum = maximumValue
defaultResolvers.maximum = minimumValue
defaultResolvers.maxItems = minimumValue
defaultResolvers.maxLength = minimumValue
defaultResolvers.maxProperties = minimumValue
defaultResolvers.minimum = maximumValue
defaultResolvers.minItems = maximumValue
defaultResolvers.minLength = maximumValue
defaultResolvers.minProperties = maximumValue
defaultResolvers.propertyNames = schemaResolver
defaultResolvers.required = required
defaultResolvers.title = first
defaultResolvers.uniqueItems = uniqueItems

function merger(rootSchema, options, totalSchemas) {
  totalSchemas = totalSchemas || []
  options = defaultsDeep(options, {
    ignoreAdditionalProperties: false,
    resolvers: defaultResolvers,
    deep: true
  })

  function mergeSchemas(schemas, base, parents) {
    schemas = cloneDeep(schemas.filter(notUndefined))
    parents = parents || []
    const merged = isPlainObject(base)
      ? base
      : {}

    // return undefined, an empty schema
    if (!schemas.length) {
      return
    }

    if (schemas.some(isFalse)) {
      return false
    }

    if (schemas.every(isTrue)) {
      return true
    }

    // there are no false and we don't need the true ones as they accept everything
    schemas = schemas.filter(isPlainObject)

    const allKeys = allUniqueKeys(schemas)
    if (options.deep && contains(allKeys, 'allOf')) {
      return merger({
        allOf: schemas
      }, options, totalSchemas)
    }

    const propertyKeys = allKeys.filter(isPropertyRelated)
    pullAll(allKeys, propertyKeys)

    const itemKeys = allKeys.filter(isItemsRelated)
    pullAll(allKeys, itemKeys)

    const conditonalKeys = allKeys.filter(isConditionalRelated)
    pullAll(allKeys, conditonalKeys)

    allKeys.forEach(function(key) {
      const values = getValues(schemas, key)
      const compacted = uniqWith(values.filter(notUndefined), compareProp(key))

      // arrayprops like anyOf and oneOf must be merged first, as they contains schemas
      // allOf is treated differently alltogether
      if (compacted.length === 1 && contains(schemaArrays, key)) {
        merged[key] = compacted[0].map(function(schema) {
          return mergeSchemas([schema], schema)
        })
        // prop groups must always be resolved
      } else if (compacted.length === 1 && !contains(schemaGroupProps, key) && !contains(schemaProps, key)) {
        merged[key] = compacted[0]
      } else {
        const resolver = options.resolvers[key] || options.resolvers.defaultResolver

        if (!resolver) {
          throw new Error('No resolver found for key ' + key + '. You can provide a resolver for this keyword in the options, or provide a default resolver.')
        }

        let merger
        // get custom merger for groups
        if (contains(schemaGroupProps, key) || contains(schemaArrays, key)) {
          merger = createRequiredSubMerger(mergeSchemas, key, parents)
        } else {
          merger = function(schemas) {
            return mergeSchemas(schemas, null, parents.concat(key))
          }
        }

        let calledWithArray = false
        const reportUnresolved = unresolvedSchemas => {
          calledWithArray = Array.isArray(unresolvedSchemas)
          return addToAllOf(unresolvedSchemas)
        }

        merged[key] = resolver(compacted, parents.concat(key), merger, options, reportUnresolved)

        if (merged[key] === undefined && !calledWithArray) {
          throwIncompatible(compacted, parents.concat(key))
        } else if (merged[key] === undefined) {
          delete merged[key]
        }
      }
    })

    Object.assign(merged, callGroupResolver(propertyKeys, 'properties', schemas, mergeSchemas, options, parents))
    Object.assign(merged, callGroupResolver(itemKeys, 'items', schemas, mergeSchemas, options, parents))
    Object.assign(merged, callGroupResolver(conditonalKeys, 'if', schemas, mergeSchemas, options, parents))

    function addToAllOf(unresolvedSchemas) {
      merged.allOf = mergeWithArray(merged.allOf, unresolvedSchemas)
    }

    return merged
  }

  const allSchemas = flattenDeep(getAllOf(rootSchema))
  const merged = mergeSchemas(allSchemas)

  return merged
}

merger.options = {
  resolvers: defaultResolvers
}

module.exports = merger
