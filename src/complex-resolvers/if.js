const { has } = require('../common')

const conditonalRelated = ['if', 'then', 'else']

module.exports = {
  // test with same if-then-else resolver
  keywords: ['if', 'then', 'else'],
  resolver(schemas, paths, mergers, options) {
    const allWithConditional = schemas.filter(schema =>
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
