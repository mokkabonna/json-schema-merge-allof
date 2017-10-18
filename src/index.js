var flatten = require('lodash/flatten')
var flattenDeep = require('lodash/flattenDeep')
var uniq = require('lodash/uniq')
var uniqWith = require('lodash/uniqWith')
var defaults = require('lodash/defaults')
var isEqual = require('lodash/isEqual')
var difference = require('lodash/difference')
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

function schemaResolver(schemas, values, compacted, key, mergeSchemas, totalSchemas, parent) {
  return mergeSchemas(compacted, key, parent || {})
}

function stringArray(values) {
  return sortBy(uniq(flattenDeep(values)))
}

function notUndefined(val) {
  return val !== undefined
}

var allKeywords = [
  '$id',
  '$schema',
  '$ref',
  'title',
  'description',
  'default',
  'multipleOf',
  'maximum',
  'exclusiveMaximum',
  'minimum',
  'exclusiveMinimum',
  'maxLength',
  'minLength',
  'pattern',
  'additionalItems',
  'items',
  'maxItems',
  'minItems',
  'uniqueItems',
  'contains',
  'maxProperties',
  'minProperties',
  'required',
  'additionalProperties',
  'definitions',
  'properties',
  'patternProperties',
  'dependencies',
  'propertyNames',
  'const',
  'enum',
  'type',
  'format',
  'allOf',
  'anyOf',
  'oneOf',
  'not'
]

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

    if (!compacted.length) return

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

      all[propKey] = mergeSchemas(innerCompacted, all[propKey] || {})
      return all
    }, compacted[0] || {})
  },
  items: function(schemas, values, compacted, key, mergeSchemas, totalSchemas) {
    if (compacted.every(isSchema)) {
      return schemaResolver.apply(null, arguments)
    } else if (compacted.every(Array.isArray)) {
      return compacted.reduce(function(all, items, pos) {
        var schemasAtCurrentPos = uniqWith(compacted.map(function(items) {
          return items[pos]
        }).filter(notUndefined), isEqual)

        all[pos] = mergeSchemas(schemasAtCurrentPos, schemasAtCurrentPos[0] || {})
        return all
      }, compacted[0])
    } else {
      // mixed type in for items property, cant resolve that
      throwIncompatible(compacted, key)
    }
  },
  oneOf: function(schemas, values, compacted, key, mergeSchemas, totalSchemas) {
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
    return stringArray(compacted)
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
  multipleOf: function(schemas, values, compacted, key) {
    var factors = 0
    compacted.forEach(function(num) {
      if (Number.isInteger(num)) return
      // 100 precition
      for (var i = 1; i < 100; i += 1) {
        num = num * 10
        factors = Math.max(i, factors)
        if (Number.isInteger(num)) {
          return num
        }
      }
    })

    console.log(compacted)
    var integers = compacted.map(function(num) {
      if (!Number.isInteger(num)) {
        var divider = 1
        for (var i = 0; i < factors; i++) {
          divider = divider * 10
        }
        return num * divider
      } else {
        return num
      }
    })
    console.log(integers)

    var divider = 1
    for (var i = 0; i < factors; i++) {
      divider = divider * 10
    }

    var max = integers.reduce(function(sum, next) {
      return sum * next
    })

    var copy = integers.slice(0).sort()
    var currentTry
    while (currentTry = copy.pop()) {
      var test = max / currentTry
      var result = integers.every(function(num) {
        return Number.isInteger(parseFloat((test / num).toFixed(5)))
      })

      console.log(integers, max, test, divider)

      if (result) return test / divider
    }
    return max / divider

    // console.log(integers)
    // console.log(factors)
    // console.log(max)
    //
    // function getIntegersForNum(numbers) {
    //   for (var i = 1; i < 10000; i += 0.1) {
    //     if (i === 0) continue
    //     var result = numbers.every(function(num) {
    //       return Number.isInteger(parseFloat((i / num).toFixed(5)))
    //     })
    //
    //     if (result) {
    //       return parseFloat(i.toFixed(4))
    //     }
    //   }
    // }
    //
    // var result = getIntegersForNum(compacted)
    // if (!result) throw new Error('Could ot find a common number for multipleOf values: ' + compacted.join(', '))
    //
    // return result
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
console.log(difference(allKeywords, Object.keys(defaultResolvers)))

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

      var compacted = uniqWith(values.filter(notUndefined), isEqual)

      // prop groups must always be resolved
      if (compacted.length === 1 && schemaGroupProps.indexOf(key) === -1) {
        merged[key] = compacted[0]
      } else if (key === 'pattern') {
        merged.allOf = compacted.map(function(regexp) {
          return {
            pattern: regexp
          }
        })
        // } else if (key === 'multipleOf') {
        //   merged.allOf = compacted.map(function(regexp) {
        //     return {
        //       multipleOf: regexp
        //     }
        //   })
      } else {
        var resolver = options.resolvers[key]
        if (!resolver) throw new Error('No resolver found for key ' + key)
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
