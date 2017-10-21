var flatten = require('lodash/flatten')
var flattenDeep = require('lodash/flattenDeep')
var uniq = require('lodash/uniq')
var uniqWith = require('lodash/uniqWith')
var isEqual = require('lodash/isEqual')
var isPlainObject = require('lodash/isPlainObject')

module.exports = {
  keys(obj) {
    if (isPlainObject(obj)) {
      return Object.keys(obj)
    } else {
      return []
    }
  },
  getValues(schemas, key) {
    return schemas.map(function(schema) {
      return schema && schema[key]
    })
  }

}
