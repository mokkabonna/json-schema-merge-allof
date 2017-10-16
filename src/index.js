var flattenDeep = require('lodash/flattenDeep')
var uniq = require('lodash/uniq')
var defaults = require('lodash/defaults')
var omit = require('lodash/omit')
var intersection = require('lodash/intersection')
var isPlainObject = require('lodash/isPlainObject')
var pull = require('lodash/pull')
// var isFunction = require('lodash/isFunction')
// var values = require('lodash/values')

function getAllOf(schema) {
  if (Array.isArray(schema.allOf)) {
    return [omit(schema, 'allOf')].concat(schema.allOf.map(function(allSchema) {
      return getAllOf(allSchema)
    }))
  } else {
    return omit(schema, 'allOf')
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
  default: function defaultResolver(schemas, values, compacted) {
    return compacted[0]
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

function simplifier(rootSchema, options) {
  options = defaults(options, {
    resolvers: defaultResolvers
  })

  function mergeSchemas(schemas, parentKey) {
    var merged = {}

    var isProperties = parentKey === 'properties'

    var allKeys = uniq(flattenDeep(schemas.map(function(schema) {
      return schema ? Object.keys(schema) : []
    })))

    var hasAllOf = allKeys.some(function(key) {
      return key === 'allOf'
    })

    if (!isProperties && hasAllOf) {
      return simplifier({
        allOf: schemas
      }, options)
    }

    allKeys = uniq(flattenDeep(schemas.map(function(schema) {
      return schema ? Object.keys(schema) : []
    })))

    allKeys.forEach(function(key) {
      if (parentKey === 'allOf') return
      var values = getValues(schemas, key)

      var hasFalse = values.some(function(val) {
        return val === false
      })

      var compacted = uniq(values.filter(function(val) {
        return val !== undefined
      }))

      var hasObjectValue = values.some(function(val) {
        return isPlainObject(val)
      })

      if (isProperties && hasFalse) {
        merged[key] = false
        return
      } else if (hasObjectValue) {
        merged[key] = mergeSchemas(compacted, key)
        return
      }

      if (compacted.length === 1) {
        merged[key] = compacted[0]
      } else {
        var resolver = options.resolvers[key] || options.resolvers.default
        merged[key] = resolver(schemas, values, compacted, key)
      }
    })

    return merged
  }

  var allSchemas = flattenDeep(getAllOf(rootSchema))
  var merged = mergeSchemas(allSchemas)
  return merged
}

module.exports = simplifier
