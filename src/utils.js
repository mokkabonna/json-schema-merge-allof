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
