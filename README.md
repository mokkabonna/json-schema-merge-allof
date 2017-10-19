# json-schema-simplify

## Features

- **Real** and **safe** merging of schemas combined with **allOf**
- Remove redundant keywords found in anyOf/oneOf
- Results in a more readable root schema
- Removes almost all logical impossibilities
- Throws if no logical intersection is found (your schema would not validate anything)
- Validates in a way not possible by regular simple meta validators.
- Pluggable
- Option to override common impossibility like adding properties when using **additionalProperties: false**
- Compare 2 schemas logically
- Supports all json schema keywords
- Supports schemas with circular references


## How

Since allOf require ALL schemas provided (including the parent schema) to apply, we can iterate over all the schemas, extracting all the values for say, **type**, and find the **intersection** of valid values. Here is an example:

```js
{
  type: '[object', 'null'],
  additionalProperties: {
    type: 'string',
    minLength: 5
  },
  allOf: [{
    type: ['array', 'object'],
    additionalProperties: {
      type: 'string',
      minLength: 10,
      maxLength: 20
    }
  }]
}
```

This result in the schema :
```js
{
  type: 'object',
  additionalProperties: {
    type: 'string',
    minLength: 10,
    maxLength: 20
  }
}
```

Notice that type now excludes null and array since those are not logically possible. Also minLength is raised to 10. The other properties have no conflict and are merged into the root schema with no resolving needed.

For other keywords other methods are used, here are some simple examples:

- minLength, minimum, minItems etc chooses the **highest** value of the conflicting values.
- maxLength, maximum, maxItems etc chooses the **lowest** value of the conflicting values.
- uniqueItems is true if **any** of the conflicting values are true

As you can see above the strategy is to choose the **most** restrictive of the set of values that conflict. For some keywords that is done by intersection, for others like **required** it is done by a union of all the values, since that is the most restrictive.

What you are left with is a schema completely free of allOf. Except for in a couple of values that are impossible to properly intersect/combine:

### pattern

If a schema have the pattern keyword and we have a conflict, then we need to leave that expressed like this:

```js
{
  type: 'string',
  allOf: [{
    pattern: '\\w+\\s\\w+'
  }, {
    pattern: '123$'
  }]
}
```

Regular expressions does not have an AND operator, only OR.

### multipleOf

multipleOf is solved in the same way as pattern. I have not yet discovered a way to detect the absolute minimum common new value multipleOf would consist of that are compatible with all the original ones.

## Options
**resolvers** Object
Override any default resolver like this:

```js
simplify(schema, {
  resolvers: {
    title: function(values, key, mergeSchemas) {
      // choose what title you want to be used based on the conflicting values
      // resolvers MUST return a value other than undefined
    }
  }
```

The function is passed:

- **values**: an array of the conflicting values that need to be resolved
- **key** the name of the keyword that caused the resolver to be called (useful if you use the same resolver for multiple keywords)
- **mergeSchemas** a function you can call that merges an array of schemas

**combineAdditionalProperties** default **false**

Allows you to combine schema properties even though some schemas have `additionalProperties: false` The resulting schema will still get additionalProperties set to false. This is the most common issue people face when trying to expand schemas using allOf and a limitation of the json schema spec.


## Resolvers

Resolvers are called whenever multiple conflicting values are found on the same position in the schemas.

You can override a resolver by supplying it in the options.

### Lossy vs lossless

All built in reducers for validation keywords are lossless, meaning that they don't remove or add anything in terms of validation.

For meta keywords like title, description, $id, $schema, default the strategy is to use the first possible value if there are conflicting ones. So the root schema is prioritized. This process possibly removes some meta information from your schema. So it's lossy. Override this by providing custom resolvers.


## $ref

If one of your schemas contain a $ref property you should resolve them using a ref resolver like [json-schema-ref-parser](https://github.com/BigstickCarpet/json-schema-ref-parser) to dereference your schema for you first. Resolving $refs are not the task of this library. Circular references like the ones possibly created by json-schema-ref-parser are supported.


## Other libraries

There exists some libraries that claim to merge schemas combined with allOf, but they just merge schemas using a **very** basic logic. Basically just the same as lodash merge. So you risk ending up with a schema that allows more or less than the original schema would allow.


## Restrictions

We cannot merge schemas that are a logical impossibility, like:

```js
{
  type: 'object',
  allOf: [{
    type: 'array'
  }]
}
```

The library will then throw an error reporting the values that had no valid intersection. But then again, your original schema wouldn't validate anything either.


## Roadmap

- [ ] Treat the interdependent validations like properties and additionalProperties as one resolver
- [ ] Implement a proper compare function that ignores sort on required, type, etc. And possibly title, description, etc.
- [ ] Extract repeating validators from anyOf/oneOf and merge them with parent schema
- [ ] After extraction of validators from anyOf/oneOf, compare them and remove duplicates.
- [ ] If left with only one in anyOf/oneOf then merge it to the parent schema.
- [ ] Expose seperate tools for validation, extraction
- [ ] Consider adding even more logical validation (like minLength <= maxLength)


## Contributing

Create tests for new functionality and follow the eslint rules.

## License

MIT © [Martin Hansen](http://martinhansen.com)
