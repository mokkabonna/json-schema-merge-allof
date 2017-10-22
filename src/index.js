var Ajv = require('ajv')
var cloneDeep = require('lodash/cloneDeep')
var compare = require('json-schema-compare')
var computeLcm = require('compute-lcm')
var defaults = require('lodash/defaults')
var flatten = require('lodash/flatten')
var flattenDeep = require('lodash/flattenDeep')
var intersection = require('lodash/intersection')
var intersectionWith = require('lodash/intersectionWith')
var isEqual = require('lodash/isEqual')
var isPlainObject = require('lodash/isPlainObject')
var pullAll = require('lodash/pullAll')
var sortBy = require('lodash/sortBy')
var forEach = require('lodash/forEach')
var uniq = require('lodash/uniq')
var uniqWith = require('lodash/uniqWith')
var without = require('lodash/without')

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
      if (schemaAtPos) {
        return schemaAtPos
      } else if (sub.hasOwnProperty('additionalItems')) {
        return sub.additionalItems
      }
    } else {
      return sub.items
    }
  })
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

function withoutArr(arr) {
  var rest = flatten([].slice.call(arguments, 1))
  return without.apply(null, [arr].concat(rest))
}

function isPropertyRelated(key) {
  return contains(propertyRelated, key)
}

function isItemsRelated(key) {
  return contains(itemsRelated, key)
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

function contains(arr, val) {
  return arr.indexOf(val) !== -1
}

function mergeWithArray(base, newItems) {
  if (Array.isArray(base)) {
    base.splice.apply(base, [0, 0].concat(newItems))
    return base
  } else {
    return newItems
  }
}

function isEmptySchema(obj) {
  return (!keys(obj).length) && obj !== false && obj !== true
}

function isSchema(val) {
  return isPlainObject(val) || val === true || val === false
}

function isFalse(val) {
  return val === false
}

function isTrue(val) {
  return val === true
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

function schemaResolver(compacted, key, mergeSchemas, totalSchemas, parent) {
  return mergeSchemas(compacted, compacted[0])
}

function stringArray(values) {
  return sortBy(uniq(flattenDeep(values)))
}

function notUndefined(val) {
  return val !== undefined
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
  type: function(compacted, key) {
    if (compacted.some(Array.isArray)) {
      var normalized = compacted.map(function(val) {
        return Array.isArray(val)
          ? val : [val]
      })
      var common = intersection.apply(null, normalized)

      if (common.length === 1) {
        return common[0]
      } else if (common.length > 1) {
        return uniq(common)
      }
    }
  },
  properties: function(values, key, mergeSchemas, totalSchemas, options) {
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
            other.properties[key] = mergeSchemas([other.properties[key], subSchema.additionalProperties])
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

    var properties = values.map(s => s.properties)
    var allProperties = uniq(flattenDeep(properties.map(keys)))
    var returnObject = {}

    returnObject.additionalProperties = mergeSchemas(values.map(s => s.additionalProperties))
    var allPatternProps = values.map(function(schema) {
      return schema.patternProperties
    })

    var allPatternKeys = uniq(flattenDeep(allPatternProps.map(keys)))
    returnObject.patternProperties = allPatternKeys.reduce(function(all, patternKey) {
      var subSchemas = getValues(allPatternProps, patternKey)
      var compacted = uniqWith(subSchemas.filter(notUndefined), compare)
      all[patternKey] = mergeSchemas(compacted)
      return all
    }, {})

    returnObject.properties = allProperties.reduce(function(all, propKey) {
      var propSchemas = getValues(properties, propKey)

      var innerCompacted = uniqWith(propSchemas.filter(notUndefined), compare)

      var foundBase = totalSchemas.find(function(schema) {
        return schema === all[propKey] && schema !== undefined && isPlainObject(schema)
      })

      if (foundBase) {
        all[propKey] = foundBase
        return all
      }

      totalSchemas.splice.apply(totalSchemas, [0, 0].concat(innerCompacted))
      all[propKey] = mergeSchemas(innerCompacted, all[propKey] || {}, true)
      return all
    }, properties[0] || {})

    if (returnObject.additionalProperties === false) {
      forEach(returnObject.properties, function(schema, prop) {
        if (schema === false) {
          delete returnObject.properties[prop]
        }
      })
    }

    // cleanup empty
    for (var prop in returnObject) {
      if (returnObject.hasOwnProperty(prop) && isEmptySchema(returnObject[prop])) {
        delete returnObject[prop]
      }
    }

    return returnObject
  },
  dependencies: function(compacted, key, mergeSchemas) {
    var allChildren = uniq(flattenDeep(compacted.map(keys)))

    return allChildren.reduce(function(all, childKey) {
      var childSchemas = getValues(compacted, childKey)
      var innerCompacted = uniqWith(childSchemas.filter(notUndefined), isEqual)

      // to support dependencies
      var allArray = innerCompacted.every(Array.isArray)
      if (allArray) {
        all[childKey] = stringArray(innerCompacted)
        return all
      }

      innerCompacted = uniqWith(innerCompacted, compare)

      all[childKey] = mergeSchemas(innerCompacted)
      return all
    }, {})
  },
  items: function(values, key, mergeSchemas) {
    var items = values.map(s => s.items)
    var itemsCompacted = items.filter(notUndefined)

    var returnObject = {}

    if (itemsCompacted.every(isSchema)) {
      returnObject.items = mergeSchemas(items)
    } else {
      var allItems = uniq(flattenDeep(items.map(keys)))

      returnObject.items = allItems.reduce(function(all, index) {
        var itemSchemas = getItemSchemas(values, index)
        var innerCompacted = uniqWith(itemSchemas.filter(notUndefined), compare)
        all[index] = mergeSchemas(innerCompacted)
        return all
      }, [])
    }

    var schemasAtLastPos
    if (itemsCompacted.every(Array.isArray)) {
      schemasAtLastPos = values.map(s => s.additionalItems)
    } else if (itemsCompacted.some(Array.isArray)) {
      schemasAtLastPos = getAdditionalSchemas(values)
    }

    if (schemasAtLastPos) {
      returnObject.additionalItems = mergeSchemas(schemasAtLastPos)
    }

    if (returnObject.additionalItems === false) {
      forEach(returnObject.items, function(schema, prop) {
        if (schema === false) {
          returnObject.items.splice(prop, 1)
        }
      })
    }

    // cleanup empty
    for (var prop in returnObject) {
      if (returnObject.hasOwnProperty(prop) && isEmptySchema(returnObject[prop])) {
        delete returnObject[prop]
      }
    }

    return returnObject
  },
  oneOf: function(compacted, key, mergeSchemas) {
    var combinations = getAnyOfCombinations(cloneDeep(compacted))

    var result = combinations.map(function(combination) {
      try {
        return mergeSchemas(combination)
      } catch (e) {
        return undefined
      }
    }).filter(notUndefined)

    var unique = uniqWith(result, compare)

    // TODO implement merging to main schema if only one left
    if (unique.length) {
      return unique
    }
  },
  not: function(compacted) {
    return {
      anyOf: compacted
    }
  },
  first: function(compacted) {
    return compacted[0]
  },
  required: function(compacted) {
    return stringArray(compacted)
  },
  minLength: function(compacted) {
    return Math.max.apply(Math, compacted)
  },
  maxLength: function(compacted) {
    return Math.min.apply(Math, compacted)
  },
  pattern: function(compacted, key, mergeSchemas, totalSchemas, reportUnresolved) {
    reportUnresolved(compacted.map(function(regexp) {
      return {
        [key]: regexp
      }
    }))
  },
  multipleOf: function(compacted) {
    var integers = compacted.slice(0)
    var factor = 1
    while (integers.some(n => !Number.isInteger(n))) {
      integers = integers.map(n => n * 10)
      factor = factor * 10
    }
    return computeLcm(integers) / factor
  },
  uniqueItems: function(compacted) {
    return compacted.some(function(val) {
      return val === true
    })
  },
  examples: function(compacted) {
    return uniqWith(flatten(compacted), isEqual)
  },
  enum: function(compacted, key) {
    var enums = intersectionWith.apply(null, compacted.concat(isEqual))
    if (enums.length) {
      return sortBy(enums)
    }
  }
}

defaultResolvers.$id = defaultResolvers.first
defaultResolvers.$schema = defaultResolvers.first
defaultResolvers.$ref = defaultResolvers.first // TODO correct? probably throw
defaultResolvers.title = defaultResolvers.first
defaultResolvers.description = defaultResolvers.first
defaultResolvers.default = defaultResolvers.first
defaultResolvers.minimum = defaultResolvers.minLength
defaultResolvers.exclusiveMinimum = defaultResolvers.minLength
defaultResolvers.minItems = defaultResolvers.minLength
defaultResolvers.minProperties = defaultResolvers.minLength
defaultResolvers.maximum = defaultResolvers.maxLength
defaultResolvers.exclusiveMaximum = defaultResolvers.maxLength
defaultResolvers.maxItems = defaultResolvers.maxLength
defaultResolvers.maxProperties = defaultResolvers.maxLength
defaultResolvers.contains = schemaResolver
defaultResolvers.additionalItems = schemaResolver
defaultResolvers.anyOf = defaultResolvers.oneOf
defaultResolvers.additionalProperties = schemaResolver
defaultResolvers.propertyNames = schemaResolver
defaultResolvers.definitions = defaultResolvers.dependencies

function merger(rootSchema, options, totalSchemas) {
  totalSchemas = totalSchemas || []
  var ajv = new Ajv()
  options = defaults(options, {
    ignoreAdditionalProperties: false,
    resolvers: defaultResolvers
  })

  function mergeSchemas(schemas, base) {
    schemas = cloneDeep(schemas.filter(notUndefined))
    var merged = isPlainObject(base)
      ? base : {}

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

    var allKeys = uniq(flattenDeep(schemas.map(keys)))

    if (contains(allKeys, 'allOf')) {
      return merger({
        allOf: schemas
      }, options, totalSchemas)
    }

    var propertyKeys = allKeys.filter(isPropertyRelated)

    if (propertyKeys.length) {
      var propResolver = options.resolvers.properties
      if (!propResolver) {
        throw new Error('No resolver found for properties.')
      }

      var compacted = uniqWith(schemas.map(function(schema) {
        return propertyKeys.reduce(function(all, key) {
          if (schema[key] !== undefined) {
            all[key] = schema[key]
          }
          return all
        }, {})
      }).filter(notUndefined), compare)

      var result = propResolver(compacted, 'properties', mergeSchemas, totalSchemas, options)

      if (!isPlainObject(result)) {
        throwIncompatible(compacted, 'properties')
      }

      Object.assign(merged, result)

      pullAll(allKeys, propertyKeys)
    }

    var itemKeys = allKeys.filter(isItemsRelated)

    if (itemKeys.length) {
      var itemsResolver = options.resolvers.items
      if (!itemsResolver) {
        throw new Error('No resolver found for items.')
      }

      var itemsCompacted = uniqWith(schemas.map(function(schema) {
        return itemKeys.reduce(function(all, key) {
          if (schema[key] !== undefined) {
            all[key] = schema[key]
          }
          return all
        }, {})
      }).filter(notUndefined), compare)

      var itemsResult = itemsResolver(itemsCompacted, 'items', mergeSchemas, totalSchemas, options)

      if (!isPlainObject(itemsResult)) {
        throwIncompatible(itemsCompacted, 'items')
      }

      Object.assign(merged, itemsResult)

      pullAll(allKeys, itemKeys)
    }

    allKeys.forEach(function(key) {
      var values = getValues(schemas, key)
      var compacted = uniqWith(values.filter(notUndefined), compareProp(key))

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
        var resolver = options.resolvers[key] || options.resolvers.defaultResolver

        if (!resolver) {
          throw new Error('No resolver found for key ' + key + '. You can provide a resolver for this keyword in the options, or provide a default resolver.')
        }

        var calledWithArray = false
        merged[key] = resolver(compacted, key, mergeSchemas, totalSchemas, function(unresolvedSchemas) {
          calledWithArray = Array.isArray(unresolvedSchemas)
          return addToAllOf(unresolvedSchemas)
        })

        // TODO check if addToAllOf was called or not, and throw if undefined returnvalue and not called
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

  var allSchemas = flattenDeep(getAllOf(rootSchema))
  var merged = mergeSchemas(allSchemas, rootSchema)

  // TODO consider having this here as a feature or just while developing
  try {
    var isValid = ajv.validateSchema(merged)

    if (!isValid) {
      throw new Error('Schema returned by resolver isn\'t valid.')
    }
  } catch (e) {
    if (!/stack/i.test(e.message)) {
      throw e
    }
  }

  return merged
}

merger.options = {
  resolvers: defaultResolvers
}

module.exports = merger
