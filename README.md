# json-schema-simplify

## Features

- **Real** and **safe** merging of schemas combined with **allOf**
- Results in a more readable schema
- Lossy or lossless (for things like title, description, etc.)
- Removes any logical impossibilities
- Throws if no logical intersection is found (your schema would not validate anything)
- Validates in a way not possible by regular meta validators.
- Pluggable
- Possibility to override common impossibility like adding properties when using **additionalProperties: false**
- Compare 2 schemas logically
- Supports all json schema keywords
- Supports schemas with circular references (object reference, not $ref)


## How

Since allOf require ALL schemas provided (including the parent schema) to apply, we can iterate over all the schemas, extracting all the values for say, **type**, and find the **intersection** of valid values.


### Resolvers

Resolvers are called whenever multiple conflicting values are found on the same position in combined schemas.


## $ref

If one of your schemas contain a $ref property you should resolve them using a ref resolver like [json-schema-ref-parser](https://github.com/BigstickCarpet/json-schema-ref-parser) to dereference your schema for you first. Resolving $refs are not the task of this library. Circular references like the ones possibly created by json-schema-ref-parser are supported.


## Other libraries

There exists some libraries that claim to merge schemas combined with allOf, but they just merge schemas using a **very** basic logic. Basically just the same as lodash merge. So you risk ending up with a schema that allows more or less then the original schema would allow.


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

- [ ] Implement a proper compare function that ignores sort on required, type, etc. And possibly title, description, etc.
- [ ] Extract repeating validators from anyOf/oneOf and merge them with parent schema
- [ ] After extration of validators from anyOf/oneOf, compare them and remove duplicates.
- [ ] If left with only one in anyOf/oneOf then merge it to the parent schema.
- [ ] Expose seperate tools for validation, extraction


## Contributing

Create tests for new functionality and follow the eslint rules.

## License

MIT © [Martin Hansen](http://martinhansen.com)
