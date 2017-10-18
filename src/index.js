var flatten = require('lodash/flatten')
var flattenDeep = require('lodash/flattenDeep')
var uniq = require('lodash/uniq')
var uniqWith = require('lodash/uniqWith')
var defaults = require('lodash/defaults')
var isEqual = require('lodash/isEqual')
// var difference = require('lodash/difference')
// var omit = require('lodash/omit')
var intersection = require('lodash/intersection')
var intersectionWith = require('lodash/intersectionWith')
var isPlainObject = require('lodash/isPlainObject')
var sortBy = require('lodash/sortBy')
// var mergeWith = require('lodash/mergeWith')
// var pull = require('lodash/pull')
// var isFunction = require('lodash/isFunction')
// var values = require('lodash/values')

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

function isSchema(val) {
  return isPlainObject(val) || val === true || val === false
}

function throwIncompatible(values, key) {
  throw new Error('Values ' + values + ' for key ' + key + ' cant be merged. They are incompatible')
}

function schemaResolver(compacted, key, mergeSchemas, totalSchemas, parent) {
  return mergeSchemas(compacted, parent || {})
}

function stringArray(values) {
  return sortBy(uniq(flattenDeep(values)))
}

function notUndefined(val) {
  return val !== undefined
}

// var allKeywords = [
//   '$id',
//   '$schema',
//   '$ref',
//   'title',
//   'description',
//   'default',
//   'multipleOf',
//   'maximum',
//   'exclusiveMaximum',
//   'minimum',
//   'exclusiveMinimum',
//   'maxLength',
//   'minLength',
//   'pattern',
//   'additionalItems',
//   'items',
//   'maxItems',
//   'minItems',
//   'uniqueItems',
//   'contains',
//   'maxProperties',
//   'minProperties',
//   'required',
//   'additionalProperties',
//   'definitions',
//   'properties',
//   'patternProperties',
//   'dependencies',
//   'propertyNames',
//   'const',
//   'enum',
//   'type',
//   'format',
//   'allOf',
//   'anyOf',
//   'oneOf',
//   'not'
// ]

// maybe not add dependencies
var schemaGroupProps = ['properties', 'patternProperties', 'definitions', 'dependencies']
var schemaProps = [
  'additionalProperties',
  'additionalItems',
  'contains',
  'propertyNames',
  'not',
  'items'
]
var schemaArrays = ['anyOf', 'oneOf']

var defaultResolvers = {
  type: function(compacted, key) {
    if (compacted.some(Array.isArray)) {
      var normalized = compacted.map(function(val) {
        return Array.isArray(val)
          ? val
          : [val]
      })
      var common = intersection.apply(null, normalized)

      if (common.length === 1) {
        return common[0]
      } else if (common.length > 1) {
        return uniq(common)
      } else {
        throwIncompatible(compacted, key)
      }
    } else {
      if (compacted.length) {
        throwIncompatible(compacted, key)
      }
    }
  },
  properties: function(compacted, key, mergeSchemas, totalSchemas) {
    var allProperties = uniq(flattenDeep(compacted.map(function(properties) {
      return Object.keys(properties)
    })))

    if (!compacted.length) {
      return
    }

    return allProperties.reduce(function(all, propKey) {
      var propSchemas = getValues(compacted, propKey)

      var innerCompacted = uniqWith(propSchemas.filter(function(val) {
        return val !== undefined
      }), isEqual)

      var foundBase = totalSchemas.find(function(schema) {
        return schema === all[propKey] && schema !== undefined && isPlainObject(schema)
      })

      if (foundBase) {
        all[propKey] = foundBase
        return all
      }

      // to support dependencies also
      var allArray = innerCompacted.every(Array.isArray)
      if (allArray) {
        all[propKey] = stringArray(innerCompacted)
        return all
      }

      totalSchemas.splice.apply(totalSchemas, [0, 0].concat(innerCompacted))
      all[propKey] = mergeSchemas(innerCompacted, all[propKey] || {}, true)
      return all
    }, compacted[0] || {})
  },
  items: function(compacted, key, mergeSchemas) {
    function getAllSchemas(arrayOfArrays, pos, max) {
      var all = []
      for (var i = 0; i < max; i++) {
        all.push(arrayOfArrays[i][pos])
      }

      return flatten(all)
    }

    if (compacted.every(isSchema)) {
      return schemaResolver.apply(null, arguments)
    } else if (compacted.every(Array.isArray)) {
      // TODO get max items
      var max = compacted.reduce(function(sum, b) {
        return Math.max(sum, b.length)
      }, 0)

      return compacted.reduce(function(all, items, pos) {
        var schemasAtCurrentPos = uniqWith(getAllSchemas(compacted, pos, max).filter(notUndefined), isEqual)

        if (schemasAtCurrentPos.length !== 1) {
          throwIncompatible(schemasAtCurrentPos, key)
        }
        all[pos] = mergeSchemas(schemasAtCurrentPos, schemasAtCurrentPos[0])
        return all
      }, compacted[0])
    } else {
      // mixed type in for items property, cant resolve that
      throwIncompatible(compacted, key)
    }
  },
  oneOf: function(compacted, key, mergeSchemas, totalSchemas, something, reportUnresolved) {
    var unresolved = compacted.map(function(anyOfGroup) {
      return {
        [key]: anyOfGroup.map(function(schema) {
          return mergeSchemas([schema], schema)
        })
      }
    })
    reportUnresolved(unresolved)
  },
  not: function(compacted) {
    return {allOf: compacted}
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
  uniqueItems: function(compacted) {
    return compacted.some(function(val) {
      return val === true
    })
  },
  enum: function(compacted, key) {
    var enums = intersectionWith.apply(null, compacted.concat(isEqual))
    if (enums.length) {
      return sortBy(enums)
    } else {
      throwIncompatible(compacted, key)
    }
  }
}

defaultResolvers.$id = defaultResolvers.first
defaultResolvers.$schema = defaultResolvers.first
defaultResolvers.$ref = defaultResolvers.first
defaultResolvers.title = defaultResolvers.first
defaultResolvers.description = defaultResolvers.first
defaultResolvers.default = defaultResolvers.first
defaultResolvers.format = defaultResolvers.first
defaultResolvers.minimum = defaultResolvers.minLength
defaultResolvers.exclusiveMinimum = defaultResolvers.minLength
defaultResolvers.minItems = defaultResolvers.minLength
defaultResolvers.minProperties = defaultResolvers.minLength
defaultResolvers.maximum = defaultResolvers.maxLength
defaultResolvers.exclusiveMaximum = defaultResolvers.maxLength
defaultResolvers.maxItems = defaultResolvers.maxLength
defaultResolvers.maxProperties = defaultResolvers.maxLength
defaultResolvers.contains = defaultResolvers.not
defaultResolvers.additionalItems = defaultResolvers.not
defaultResolvers.anyOf = defaultResolvers.oneOf
defaultResolvers.additionalProperties = schemaResolver
defaultResolvers.propertyNames = schemaResolver
defaultResolvers.definitions = defaultResolvers.properties
defaultResolvers.patternProperties = defaultResolvers.properties
defaultResolvers.dependencies = defaultResolvers.properties

// unsupported:
// console.log(difference(allKeywords, Object.keys(defaultResolvers)))

function simplifier(rootSchema, options, totalSchemas) {
  totalSchemas = totalSchemas || []
  options = defaults(options, {
    combineAdditionalProperties: false,
    resolvers: defaultResolvers
  })

  function mergeSchemas(schemas, base, isGroup) {
    var merged = isPlainObject(base)
      ? base
      : {}

    var incompatibleSchemas = schemas.some(function(schema) {
      return isPlainObject(schema) && schema.additionalProperties === false
    })

    if (incompatibleSchemas && schemas.length > 1 && !options.combineAdditionalProperties) {
      throw new Error('One of your schemas has additionalProperties set to false. You have an invalid schema. Override by using option combineAdditionalProperties:true')
    }

    var hasFalse = schemas.some(function(schema) {
      return schema === false
    })

    if (hasFalse) {
      return false
    }

    var allTrue = schemas.every(function(schema) {
      return schema === true
    })

    if (allTrue) {
      return true
    }

    schemas = schemas.filter(function(schema) {
      return isPlainObject(schema)
    })

    var allKeys = uniq(flattenDeep(schemas.map(function(schema) {
      return schema
        ? Object.keys(schema)
        : []
    })))

    var hasAllOf = allKeys.some(function(key) {
      return key === 'allOf'
    })

    if (hasAllOf) {
      merged.allOf = Array.isArray(merged.allOf)
        ? merged.allOf.concat(schemas)
        : schemas
      return simplifier(merged, options, totalSchemas)
    }

    allKeys.forEach(function(key) {
      var values = getValues(schemas, key)

      var compacted = uniqWith(values.filter(notUndefined), isEqual)

      // arrayprops like anyOf and oneOf must be merged first, as they contains schemas
      if (compacted.length === 1 && schemaArrays.indexOf(key) !== -1) {
        merged[key] = compacted[0].map(function(schema) {
          return mergeSchemas([schema], schema)
        })
      // prop groups must always be resolved
      } else if (compacted.length === 1 && schemaGroupProps.indexOf(key) === -1 && schemaProps.indexOf(key) === -1) {
        merged[key] = compacted[0]
      } else if (key === 'pattern') {
        merged.allOf = mergeWithArray(merged.allOf, compacted.map(function(regexp) {
          return {pattern: regexp}
        }))
      } else if (key === 'multipleOf') {
        merged.allOf = mergeWithArray(merged.allOf, compacted.map(function(regexp) {
          return {multipleOf: regexp}
        }))
      } else {
        var resolver = options.resolvers[key]
        if (!resolver) {
          throw new Error('No resolver found for key ' + key)
        }

        merged[key] = resolver(compacted, key, mergeSchemas, totalSchemas, merged[key] || {}, function addToAllOf(unresolvedSchemas) {
          merged.allOf = mergeWithArray(merged.allOf, unresolvedSchemas)
        })

        // todo check if addToAllOf was called or not, and throw if undefined returnvalue and not called
        if (merged[key] === undefined) {
          delete merged[key]
        }
      }
    })

    return merged
  }

  function mergeWithArray(base, newItems) {
    if (Array.isArray(base)) {
      return base.splice.apply(base, [0, 0].concat(newItems))
    } else {
      return newItems
    }
  }

  var allSchemas = flattenDeep(getAllOf(rootSchema))
  var merged = mergeSchemas(allSchemas, rootSchema)
  return merged
}

module.exports = simplifier
