var flatten = require('lodash/flatten')
var flattenDeep = require('lodash/flattenDeep')
var uniq = require('lodash/uniq')
var uniqWith = require('lodash/uniqWith')
var defaults = require('lodash/defaults')
var isEqual = require('lodash/isEqual')
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

function throwIncompatible(values, key) {
  throw new Error('Values ' + values + ' for key ' + key + ' cant be merged. They are incompatible')
}

function schemaResolver(schemas, values, compacted, key, mergeSchemas, totalSchemas, parent) {
  return mergeSchemas(compacted, key, parent || {})
}

// maybe not add dependencies
var schemaGroupProps = ['properties', 'patternProperties', 'definitions', 'dependencies']
var defaultResolvers = {
  type: function(schemas, values, compacted, key) {
    if (compacted.some(Array.isArray)) {
      var normalized = compacted.map(function(val) {
        return Array.isArray(val) ? val : [val]
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
  properties: function(schemas, values, compacted, key, mergeSchemas, totalSchemas) {
    var allProperties = uniq(flattenDeep(compacted.map(function(properties) {
      return Object.keys(properties)
    })))

    if(!compacted.length) return

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

      totalSchemas.splice.apply(totalSchemas, [0,0].concat(innerCompacted))

      all[propKey] = mergeSchemas(innerCompacted, all[propKey] || {})
      return all
    }, compacted[0] || {})
  },
  oneOf: function(schemas, values, compacted, key) {
    var oneOfs = intersectionWith.apply(null, compacted.concat(isEqual))
    if (oneOfs.length) {
      return sortBy(oneOfs)
    } else {
      throwIncompatible(compacted, key)
    }
  },
  not: function(schemas, values, compacted) {
    return {
      allOf: compacted
    }
  },
  first: function(schemas, values, compacted) {
    return compacted[0]
  },
  required: function(schemas, values, compacted, key) {
    return sortBy(uniq(flattenDeep(compacted)))
  },
  minLength: function(schemas, values, compacted) {
    return Math.max.apply(Math, compacted)
  },
  maxLength: function(schemas, values, compacted) {
    return Math.min.apply(Math, compacted)
  },
  uniqueItems: function(schemas, values, compacted, key) {
    return compacted.some(function(val) {
      return val === true
    })
  },
  const: function(schemas, values, compacted, key) {
    throwIncompatible(compacted, key)
  },
  enum: function(schemas, values, compacted, key) {
    var enums = intersectionWith.apply(null, compacted.concat(isEqual))
    if (enums.length) {
      return sortBy(enums)
    } else {
      throwIncompatible(compacted, key)
    }
  }
}

defaultResolvers.minimum = defaultResolvers.minLength
defaultResolvers.exclusiveMinimum = defaultResolvers.minLength
defaultResolvers.minItems = defaultResolvers.minLength
defaultResolvers.minProperties = defaultResolvers.minLength
defaultResolvers.maximum = defaultResolvers.maxLength
defaultResolvers.exclusiveMaximum = defaultResolvers.maxLength
defaultResolvers.maxItems = defaultResolvers.maxLength
defaultResolvers.maxProperties = defaultResolvers.maxLength
defaultResolvers.contains = defaultResolvers.not
defaultResolvers.pattern = defaultResolvers.not
defaultResolvers.additionalItems = defaultResolvers.not
defaultResolvers.anyOf = defaultResolvers.oneOf
defaultResolvers.additionalProperties = schemaResolver
defaultResolvers.definitions = defaultResolvers.properties

function simplifier(rootSchema, options, totalSchemas) {
  totalSchemas = totalSchemas || []
  options = defaults(options, {
    combineAdditionalProperties: false,
    resolvers: defaultResolvers
  })

  function mergeSchemas(schemas, base) {
    var merged = isPlainObject(base) ? base : {}

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

    schemas = schemas.filter(function(schema) {
      return isPlainObject(schema)
    })

    var allKeys = uniq(flattenDeep(schemas.map(function(schema) {
      return schema ? Object.keys(schema) : []
    })))

    var hasAllOf = allKeys.some(function(key) {
      return key === 'allOf'
    })

    if (hasAllOf) {
      merged.allOf = Array.isArray(merged.allOf) ? merged.allOf.concat(schemas) : schemas
      return simplifier(merged, options, totalSchemas)
    }

    allKeys.forEach(function(key) {
      var values = getValues(schemas, key)

      var compacted = uniqWith(values.filter(function(val) {
        return val !== undefined
      }), isEqual)

      //prop groups must always be resolved
      if (compacted.length === 1 && schemaGroupProps.indexOf(key) === -1) {
        merged[key] = compacted[0]
      } else if (key === 'pattern') {
        merged.allOf = compacted.map(function(regexp) {
          return {
            pattern: regexp
          }
        })
      } else if (key === 'multipleOf') {
        merged.allOf = compacted.map(function(regexp) {
          return {
            multipleOf: regexp
          }
        })
      } else {
        var resolver = options.resolvers[key] || options.resolvers.first
        merged[key] = resolver(schemas, values, compacted, key, mergeSchemas, totalSchemas, merged[key] || {})
      }
    })

    return merged
  }

  var allSchemas = flattenDeep(getAllOf(rootSchema))
  var merged = mergeSchemas(allSchemas, rootSchema)
  return merged
}

module.exports = simplifier
