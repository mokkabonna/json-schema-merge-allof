var isEqual = require('lodash/isEqual')
var sortBy = require('lodash/sortBy')
var uniq = require('lodash/uniq')
var every = require('lodash/every')
var defaults = require('lodash/defaults')
var isPlainObject = require('lodash/isPlainObject')
var isBoolean = require('lodash/isBoolean')
var utils = require('./utils')

var normalizeArray = val => Array.isArray(val)
  ? val
  : [val]
var stringArray = arr => sortBy(uniq(arr))
var undefEmpty = val => val === undefined || (Array.isArray(val) && val.length === 0)
var keyValEqual = (a, b, key, compare) => b && b.hasOwnProperty(key) && compare(a[key], b[key])
var undefAndZero = (a, b) => (a === undefined && b === 0) || (b === undefined && a === 0)
var falseUndefined = (a, b) => (a === undefined && b === false) || (b === undefined && a === false)

function undefArrayEqual(a, b) {
  if (undefEmpty(a) && undefEmpty(b)) {
    return true
  } else {
    return isEqual(stringArray(a), stringArray(b))
  }
}

function unsortedNormalizedArray(a, b) {
  a = normalizeArray(a)
  b = normalizeArray(b)
  return isEqual(stringArray(a), stringArray(b))
}

function schemaGroup(a, b, key, compare) {
  return every(a, function(schema, name) {
    if (Array.isArray(a[name]) && Array.isArray(b[name])) {
      return isEqual(stringArray(a), stringArray(b))
    }
    return keyValEqual(a, b, name, compare)
  })
}

function items(a, b, key, compare) {
  if (isPlainObject(a) && isPlainObject(b)) {
    return compare(a, b)
  } else if (Array.isArray(a) && Array.isArray(b)) {
    return schemaGroup(a, b, key, compare)
  } else {
    return isEqual(a, b)
  }
}

function emptySchema(schema) {
  return schema === undefined || isEqual(schema, {}) || schema === true
}

function isSchema(val) {
  return isPlainObject(val) || val === true || val === false
}

var comparers = {
  title: isEqual,
  uniqueItems: falseUndefined,
  minLength: undefAndZero,
  minItems: undefAndZero,
  minProperties: undefAndZero,
  required: undefArrayEqual,
  enum: undefArrayEqual,
  type: unsortedNormalizedArray,
  items: items,
  properties: schemaGroup,
  patternProperties: schemaGroup,
  dependencies: schemaGroup
}

function compare(a, b, options) {
  options = defaults(options, {ignore: []})

  if (emptySchema(a) && emptySchema(b)) { return true }

  if (!isSchema(a) || !isSchema(b)) {
    console.log(a)
    console.log(b)
    throw new Error('Either of the values are not a JSON schema.')
  }

  if (a === b) {
    return true
  }

  if (isBoolean(a) && isBoolean(b)) {
    return a === b
  }

  var allKeys = uniq(utils.keys(a).concat(utils.keys(b)))

  if (options.ignore.length) {
    allKeys = allKeys.filter(k => options.ignore.indexOf(k) === -1)
  }

  if (!allKeys.length) {
    return true
  }

  function innerCompare(a, b) {
    return compare(a, b, options)
  }

  return allKeys.every(function(key) {
    var comparer = comparers[key]
    if (!comparer) {
      console.log('USING DEFAULT LODASH COMPARER')
      // throw new Error('No comparer found for key: ' + key)
      comparer = isEqual
    }

    var aValue = a[key]
    var bValue = b[key]

    // do simple lodash check first
    if (isEqual(aValue, bValue)) {
      return true
    }

    var result = comparer(aValue, bValue, key, innerCompare)
    if (result !== true && result !== false) {
      throw new Error('Comparer must return true or false')
    }
    return result
  })
}

module.exports = compare
