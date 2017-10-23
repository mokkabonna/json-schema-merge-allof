var cloneDeep = require('lodash/cloneDeep')
var compare = require('json-schema-compare')
var computeLcm = require('compute-lcm')
var defaultsDeep = require('lodash/defaultsDeep')
var flatten = require('lodash/flatten')
var flattenDeep = require('lodash/flattenDeep')
var intersection = require('lodash/intersection')
var intersectionWith = require('lodash/intersectionWith')
var isEqual = require('lodash/isEqual')
var isString = require('lodash/isString')
var pick = require('lodash/pick')
var isPlainObject = require('lodash/isPlainObject')
var pullAll = require('lodash/pullAll')
var get = require('lodash/get')
var sortBy = require('lodash/sortBy')
var forEach = require('lodash/forEach')
var uniq = require('lodash/uniq')
var uniqWith = require('lodash/uniqWith')
var without = require('lodash/without')

var withoutArr = (arr, ...rest) => without.apply(null, [arr].concat(flatten(rest)))
var normalizeAsArray = (obj) => Array.isArray(obj) ? obj : [obj]
var isPropertyRelated = (key) => contains(propertyRelated, key)
var isItemsRelated = (key) => contains(itemsRelated, key)
var contains = (arr, val) => arr.indexOf(val) !== -1
var isEmptySchema = (obj) => (!keys(obj).length) && obj !== false && obj !== true
var isSchema = (val) => isPlainObject(val) || val === true || val === false
var isFalse = (val) => val === false
var isTrue = (val) => val === true
var schemaResolver = (compacted, key, mergeSchemas) => mergeSchemas(compacted)
var stringArray = (values) => sortBy(uniq(flattenDeep(values)))
var notUndefined = (val) => val !== undefined
var allUniqueKeys = (arr) => uniq(flattenDeep(arr.map(keys)))

// resolvers
var first = compacted => compacted[0]
var required = compacted => stringArray(compacted)
var maximumValue = compacted => Math.max.apply(Math, compacted)
var minimumValue = compacted => Math.min.apply(Math, compacted)
var uniqueItems = compacted => compacted.some(isTrue)
var examples = compacted => uniqWith(flatten(compacted), isEqual)

function compareProp(key) {
  return function(a, b) {
    return compare({
      [key]: a
    }, {
      [key]: b
    })
  }
}

function getAllOf(schema) {
  if (Array.isArray(schema.allOf)) {
    var allOf = schema.allOf
    delete schema.allOf
    return [schema].concat(allOf.map(function(allSchema) {
      return getAllOf(allSchema)
    }))
  } else {
    return [schema]
  }
}

function getValues(schemas, key) {
  return schemas.map(function(schema) {
    return schema && schema[key]
  })
}

function getItemSchemas(subSchemas, key) {
  return subSchemas.map(function(sub) {
    if (!sub) return

    if (Array.isArray(sub.items)) {
      var schemaAtPos = sub.items[key]
      if (isSchema(schemaAtPos)) {
        return schemaAtPos
      } else if (sub.hasOwnProperty('additionalItems')) {
        return sub.additionalItems
      }
    } else {
      return sub.items
    }
  })
}

function tryMergeSchemaGroups(schemaGroups, mergeSchemas) {
  return schemaGroups.map(function(schemas) {
    try {
      return mergeSchemas(schemas)
    } catch (e) {
      return undefined
    }
  }).filter(notUndefined)
}

function getAdditionalSchemas(subSchemas) {
  return subSchemas.map(function(sub) {
    if (!sub) return
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

  var values = arrOfArrays.slice(0).shift()
  var rest = arrOfArrays.slice(1)
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

function throwIncompatible(values, key) {
  var asJSON
  try {
    asJSON = JSON.stringify(values, null, 2)
  } catch (variable) {
    asJSON = values.join(', ')
  }
  throw new Error('Could not resolve values for keyword:"' + key + '". They are probably incompatible. Values: ' + asJSON)
}

function cleanupReturnValue(returnObject) {
  // cleanup empty
  for (var prop in returnObject) {
    if (returnObject.hasOwnProperty(prop) && isEmptySchema(returnObject[prop])) {
      delete returnObject[prop]
    }
  }
  return returnObject
}

function callGroupResolver(keys, resolverName, schemas, mergeSchemas, options, totalSchemas) {
  if (keys.length) {
    var resolver = options.resolvers[resolverName]
    if (!resolver) {
      throw new Error('No resolver found for ' + resolverName)
    }

    var compacted = uniqWith(schemas.map(function(schema) {
      return keys.reduce(function(all, key) {
        if (schema[key] !== undefined) {
          all[key] = schema[key]
        }
        return all
      }, {})
    }).filter(notUndefined), compare)

    var result = resolver(compacted, resolverName, mergeSchemas, options, totalSchemas)

    if (!isPlainObject(result)) {
      throwIncompatible(compacted, resolverName)
    }

    return cleanupReturnValue(result)
  }
}

// Provide source when array
function mergeSchemaGroup(group, mergeSchemas, source) {
  var allKeys = allUniqueKeys(source || group)
  var extractor = source ? getItemSchemas : getValues
  return allKeys.reduce(function(all, key) {
    var schemas = extractor(group, key)
    var compacted = uniqWith(schemas.filter(notUndefined), compare)
    console.log(compacted, key)
    all[key] = mergeSchemas(compacted, key)

    return all
  }, source ? [] : {})
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
  return {
    required: arr
  }
}

var propertyRelated = ['properties', 'patternProperties', 'additionalProperties']
var itemsRelated = ['items', 'additionalItems']
var schemaGroupProps = ['properties', 'patternProperties', 'definitions', 'dependencies']
var schemaArrays = ['anyOf', 'oneOf']
var schemaProps = [
  'additionalProperties',
  'additionalItems',
  'contains',
  'propertyNames',
  'not',
  'items'
]

var defaultResolvers = {
  type(compacted, key) {
    if (compacted.some(Array.isArray)) {
      var normalized = compacted.map(function(val) {
        return Array.isArray(val) ? val : [val]
      })
      var common = intersection.apply(null, normalized)

      if (common.length === 1) {
        return common[0]
      } else if (common.length > 1) {
        return uniq(common)
      }
    }
  },
  properties(values, key, mergeSchemas, options, totalSchemas) {
    // first get rid of all non permitted properties
    if (!options.ignoreAdditionalProperties) {
      values.forEach(function(subSchema) {
        var otherSubSchemas = values.filter(s => s !== subSchema)
        var ownKeys = keys(subSchema.properties)
        var ownPatternKeys = keys(subSchema.patternProperties)
        var ownPatterns = ownPatternKeys.map(k => new RegExp(k))
        otherSubSchemas.forEach(function(other) {
          var allOtherKeys = keys(other.properties)
          var keysMatchingPattern = allOtherKeys.filter(k => ownPatterns.some(pk => pk.test(k)))
          var additionalKeys = withoutArr(allOtherKeys, ownKeys, keysMatchingPattern)
          additionalKeys.forEach(function(key) {
            other.properties[key] = mergeSchemas([other.properties[key], subSchema.additionalProperties], ['properties', key])
          })
        })
      })

      // remove disallowed patternProperties
      values.forEach(function(subSchema) {
        var otherSubSchemas = values.filter(s => s !== subSchema)
        var ownPatternKeys = keys(subSchema.patternProperties)
        if (subSchema.additionalProperties === false) {
          otherSubSchemas.forEach(function(other) {
            var allOtherPatterns = keys(other.patternProperties)
            var additionalPatternKeys = withoutArr(allOtherPatterns, ownPatternKeys)
            additionalPatternKeys.forEach(key => delete other.patternProperties[key])
          })
        }
      })
    }

    function createMerger(parentKey) {
      return function(schemas, key) {
        return mergeSchemas(schemas, [parentKey].concat(key))
      }
    }

    var returnObject = {
      additionalProperties: mergeSchemas(values.map(s => s.additionalProperties), ['additionalProperties']),
      patternProperties: mergeSchemaGroup(values.map(s => s.patternProperties), createMerger('patternProperties')),
      properties: mergeSchemaGroup(values.map(s => s.properties), createMerger('properties'))
    }

    if (returnObject.additionalProperties === false) {
      removeFalseSchemas(returnObject.properties)
    }

    return returnObject
  },
  dependencies(compacted, key, mergeSchemas) {
    var allChildren = allUniqueKeys(compacted)

    return allChildren.reduce(function(all, childKey) {
      var childSchemas = getValues(compacted, childKey)
      var innerCompacted = uniqWith(childSchemas.filter(notUndefined), isEqual)

      // to support dependencies
      var innerArrays = innerCompacted.filter(Array.isArray)

      if (innerArrays.length) {
        if (innerArrays.length === innerCompacted.length) {
          all[childKey] = stringArray(innerCompacted)
        } else {
          var innerSchemas = innerCompacted.filter(isSchema)
          var arrayMetaScheams = innerArrays.map(createRequiredMetaArray)
          all[childKey] = mergeSchemas(innerSchemas.concat(arrayMetaScheams), [childKey])
        }
        return all
      }

      innerCompacted = uniqWith(innerCompacted, compare)

      all[childKey] = mergeSchemas(innerCompacted, [childKey])
      return all
    }, {})
  },
  items(values, key, mergeSchemas) {
    var items = values.map(s => s.items)
    var itemsCompacted = items.filter(notUndefined)
    var returnObject = {}

    function createMerger(parentKey) {
      return function(schemas, key) {
        return mergeSchemas(schemas, [parentKey].concat(key))
      }
    }

    if (itemsCompacted.every(isSchema)) {
      returnObject.items = mergeSchemas(items, ['items'])
    } else {
      returnObject.items = mergeSchemaGroup(values, createMerger('items'), items)
    }

    var schemasAtLastPos
    if (itemsCompacted.every(Array.isArray)) {
      schemasAtLastPos = values.map(s => s.additionalItems)
    } else if (itemsCompacted.some(Array.isArray)) {
      schemasAtLastPos = getAdditionalSchemas(values)
    }

    if (schemasAtLastPos) {
      returnObject.additionalItems = mergeSchemas(schemasAtLastPos, ['additionalItems'])
    }

    if (returnObject.additionalItems === false && Array.isArray(returnObject.items)) {
      removeFalseSchemasFromArray(returnObject.items)
    }

    return returnObject
  },
  oneOf(compacted, key, mergeSchemas) {
    var combinations = getAnyOfCombinations(cloneDeep(compacted))
    var result = tryMergeSchemaGroups(combinations, mergeSchemas)
    var unique = uniqWith(result, compare)

    if (unique.length) {
      return unique
    }
  },
  not(compacted) {
    return {
      anyOf: compacted
    }
  },
  pattern(compacted, key, mergeSchemas, reportUnresolved) {
    reportUnresolved(compacted.map(function(regexp) {
      return {
        [key]: regexp
      }
    }))
  },
  multipleOf(compacted) {
    var integers = compacted.slice(0)
    var factor = 1
    while (integers.some(n => !Number.isInteger(n))) {
      integers = integers.map(n => n * 10)
      factor = factor * 10
    }
    return computeLcm(integers) / factor
  },
  enum(compacted, key) {
    var enums = intersectionWith.apply(null, compacted.concat(isEqual))
    if (enums.length) {
      return sortBy(enums)
    }
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

function merger(rootSchema, options) {
  options = defaultsDeep(options, {
    ignoreAdditionalProperties: false,
    resolvers: defaultResolvers
  })

  var totalSchemas = { }
  var root = {}
  var allObjects = { }

  function findCircular(obj, paths) {
    if (!paths) {
      totalSchemas[''] = {}
      allObjects[''] = obj
    }

    paths = paths || []
    Object.keys(obj).forEach(function(key) {
      var innerPath = paths.slice(0)
      innerPath.push(key)
      var path = innerPath.join('.')
      var schema = obj[key]
      if (!isPlainObject(schema)) {
        return
      }
      var existing = Object.keys(allObjects).find(k => allObjects[k] === schema)
      if (existing !== undefined) {
        allObjects[path] = existing
        var current = {}
        totalSchemas[path] = current
        totalSchemas[existing] = current
      } else {
        allObjects[path] = schema
        if (isPlainObject(schema)) {
          findCircular(schema, innerPath)
        }
      }
    })
  }

  findCircular(rootSchema)
  var circularKeys = Object.keys(allObjects).filter(function(key) {
    return isString(allObjects[key])
  })

  console.log(totalSchemas)
  allObjects = pick(allObjects, circularKeys)

  console.log(totalSchemas['properties.person'] === totalSchemas['properties.person.properties.child'])
  var max = 30
  var current = 0
  function mergeSchemas(schemas, paths) {
    paths = paths || []
    schemas = normalizeAsArray(schemas).filter(notUndefined)
    schemas = cloneDeep(schemas)

    var path = paths.join('.')

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

    current++
    if (current > max) {
      return
    }

    // there are no false and we don't need the true ones as they accept everything
    schemas = schemas.filter(isPlainObject)

    // var found = totalSchemas[path]

    var merged = totalSchemas[allObjects[path]] || {}
    if (path === '') {
      merged = totalSchemas[''] || {}
    } else if (allObjects[path]) {
      console.log('found', path, allObjects[path])
      return totalSchemas[allObjects[path]]
    }

    var allKeys = allUniqueKeys(schemas)

    if (contains(allKeys, 'allOf')) {
      return mergeSchemas(flattenDeep(schemas.map(s => getAllOf(s))), paths)
    }

    function createMerger(key) {
      return function innerMergeSchemas(schemas, additionalKeys) {
        additionalKeys = Array.isArray(additionalKeys) ? additionalKeys : []
        return mergeSchemas(schemas, paths.concat(key).concat(additionalKeys))
      }
    }

    var propertyKeys = allKeys.filter(isPropertyRelated)
    Object.assign(merged, callGroupResolver(propertyKeys, 'properties', schemas, function(schemas, innerPaths) {
      console.log(paths.concat(innerPaths), schemas)
      return mergeSchemas(schemas, paths.concat(innerPaths))
    }, options, totalSchemas))
    pullAll(allKeys, propertyKeys)

    var itemKeys = allKeys.filter(isItemsRelated)
    Object.assign(merged, callGroupResolver(itemKeys, 'items', schemas, function(schemas, innerPaths) {
      return mergeSchemas(schemas, paths.concat(innerPaths))
    }, options))
    pullAll(allKeys, itemKeys)

    allKeys.forEach(function(key) {
      var values = getValues(schemas, key)
      var compacted = uniqWith(values.filter(notUndefined), compareProp(key))

      // arrayprops like anyOf and oneOf must be merged first, as they contains schemas
      // allOf is treated differently alltogether
      if (compacted.length === 1 && contains(schemaArrays, key)) {
        merged[key] = compacted[0].map(function(schema) {
          return mergeSchemas(schema, paths.concat(key))
        })
        // prop groups must always be resolved
      } else if (compacted.length === 1 && !contains(schemaGroupProps, key) && !contains(schemaProps, key)) {
        merged[key] = compacted[0]
      } else {
        var resolver = options.resolvers[key] || options.resolvers.defaultResolver

        if (!resolver) {
          throw new Error('No resolver found for key ' + key + '. You can provide a resolver for this keyword in the options, or provide a default resolver.')
        }

        var calledWithArray = false
        merged[key] = resolver(compacted, key, createMerger(key), function(unresolvedSchemas) {
          calledWithArray = Array.isArray(unresolvedSchemas)
          return addToAllOf(unresolvedSchemas)
        })

        if (merged[key] === undefined && !calledWithArray) {
          throwIncompatible(compacted, key)
        } else if (merged[key] === undefined) {
          delete merged[key]
        }
      }
    })

    function addToAllOf(unresolvedSchemas) {
      merged.allOf = mergeWithArray(merged.allOf, unresolvedSchemas)
    }

    return merged
  }

  return mergeSchemas(cloneDeep(rootSchema))
}

merger.options = {
  resolvers: defaultResolvers
}

module.exports = merger
