import { describe, it } from 'vitest';
import { expect } from 'chai';
import _, { isObject, flatten, intersection } from 'lodash';
import { dereference } from 'json-schema-ref-parser';
import { mergeAndTest } from '../utils/merger.js';
import merger from '../../src/index.js';

describe('module', function () {
  it('merges schema with same object reference multiple places', () => {
    const commonSchema = {
      allOf: [
        {
          properties: {
            test: true
          }
        }
      ]
    };
    const result = merger({
      properties: {
        list: {
          items: commonSchema
        }
      },
      allOf: [commonSchema]
    });

    expect(result).to.eql({
      properties: {
        list: {
          items: {
            properties: {
              test: true
            }
          }
        },
        test: true
      }
    });
  });

  it('does not alter original schema', () => {
    const schema = {
      allOf: [
        {
          properties: {
            test: true
          }
        }
      ]
    };

    const result = merger(schema);

    expect(result).to.eql({
      properties: {
        test: true
      }
    });

    expect(result).not.to.equal(schema); // not strict equal (identity)
    expect(schema).to.eql({
      allOf: [
        {
          properties: {
            test: true
          }
        }
      ]
    });
  });

  it('does not use any original objects or arrays', () => {
    const schema = {
      properties: {
        arr: {
          type: 'array',
          items: {
            type: 'object'
          },
          additionalItems: [
            {
              type: 'array'
            }
          ]
        }
      },
      allOf: [
        {
          properties: {
            test: true
          }
        }
      ]
    };

    function innerDeconstruct(schema) {
      const allChildObj = Object.entries(schema).map(([, val]) => {
        if (isObject(val)) return innerDeconstruct(val);
        else return undefined;
      });
      return [schema, ...flatten(allChildObj)];
    }

    const getAllObjects = (schema) =>
      _(innerDeconstruct(schema)).compact().value();
    const inputObjects = getAllObjects(schema);

    const result = merger(schema);
    const resultObjects = getAllObjects(result);

    const commonObjects = intersection(inputObjects, resultObjects);
    expect(commonObjects).to.have.length(0);
  });

  it('combines simple usecase', function () {
    const result = mergeAndTest({
      allOf: [
        {
          type: 'string',
          minLength: 1
        },
        {
          type: 'string',
          maxLength: 5
        }
      ]
    });

    expect(result).to.eql({
      type: 'string',
      minLength: 1,
      maxLength: 5
    });
  });

  it('combines without allOf', function () {
    const result = mergeAndTest({
      properties: {
        foo: {
          type: 'string'
        }
      }
    });

    expect(result).to.eql({
      properties: {
        foo: {
          type: 'string'
        }
      }
    });
  });

  describe('simple resolve functionality', function () {
    it('merges with default resolver if not defined resolver', function () {
      const result = merger({
        title: 'schema1',
        allOf: [
          {
            title: 'schema2'
          },
          {
            title: 'schema3'
          }
        ]
      });

      expect(result).to.eql({
        title: 'schema1'
      });

      const result3 = merger({
        allOf: [
          {
            title: 'schema2'
          },
          {
            title: 'schema3'
          }
        ]
      });

      expect(result3).to.eql({
        title: 'schema2'
      });
    });

    it('merges minLength if conflict', function () {
      const result = mergeAndTest({
        allOf: [
          {
            minLength: 1
          },
          {
            minLength: 5
          }
        ]
      });

      expect(result).to.eql({
        minLength: 5
      });
    });

    it('merges minimum if conflict', function () {
      const result = mergeAndTest({
        allOf: [
          {
            minimum: 1
          },
          {
            minimum: 5
          }
        ]
      });

      expect(result).to.eql({
        minimum: 5
      });
    });

    it('merges exclusiveMinimum if conflict', function () {
      const result = merger({
        allOf: [
          {
            exclusiveMinimum: 1
          },
          {
            exclusiveMinimum: 5
          }
        ]
      });

      expect(result).to.eql({
        exclusiveMinimum: 5
      });
    });

    it('merges minItems if conflict', function () {
      const result = mergeAndTest({
        allOf: [
          {
            minItems: 1
          },
          {
            minItems: 5
          }
        ]
      });

      expect(result).to.eql({
        minItems: 5
      });
    });

    it('merges maximum if conflict', function () {
      const result = mergeAndTest({
        allOf: [
          {
            maximum: 1
          },
          {
            maximum: 5
          }
        ]
      });

      expect(result).to.eql({
        maximum: 1
      });
    });

    it('merges exclusiveMaximum if conflict', function () {
      const result = mergeAndTest({
        allOf: [
          {
            exclusiveMaximum: 1
          },
          {
            exclusiveMaximum: 5
          }
        ]
      });

      expect(result).to.eql({
        exclusiveMaximum: 1
      });
    });

    it('merges maxItems if conflict', function () {
      const result = mergeAndTest({
        allOf: [
          {
            maxItems: 1
          },
          {
            maxItems: 5
          }
        ]
      });

      expect(result).to.eql({
        maxItems: 1
      });
    });

    it('merges maxLength if conflict', function () {
      const result = mergeAndTest({
        allOf: [
          {
            maxLength: 4
          },
          {
            maxLength: 5
          }
        ]
      });

      expect(result).to.eql({
        maxLength: 4
      });
    });

    it('merges uniqueItems to most restrictive if conflict', function () {
      const result = mergeAndTest({
        allOf: [
          {
            uniqueItems: true
          },
          {
            uniqueItems: false
          }
        ]
      });

      expect(result).to.eql({
        uniqueItems: true
      });

      expect(
        merger({
          allOf: [
            {
              uniqueItems: false
            },
            {
              uniqueItems: false
            }
          ]
        })
      ).to.eql({
        uniqueItems: false
      });
    });

    it('throws if merging incompatible type', function () {
      expect(function () {
        mergeAndTest({
          allOf: [
            {
              type: 'null'
            },
            {
              type: 'text'
            }
          ]
        });
      }).to.throw(/incompatible/);
    });

    it('merges type if conflict', function () {
      const result = mergeAndTest({
        allOf: [
          {},
          {
            type: ['string', 'null', 'object', 'array']
          },
          {
            type: ['string', 'null']
          },
          {
            type: ['null', 'string']
          }
        ]
      });

      expect(result).to.eql({
        type: ['string', 'null']
      });

      const result2 = mergeAndTest({
        allOf: [
          {},
          {
            type: ['string', 'null', 'object', 'array']
          },
          {
            type: 'string'
          },
          {
            type: ['null', 'string']
          }
        ]
      });

      expect(result2).to.eql({
        type: 'string'
      });

      expect(function () {
        mergeAndTest({
          allOf: [
            {
              type: ['null']
            },
            {
              type: ['text', 'object']
            }
          ]
        });
      }).to.throw(/incompatible/);
    });

    it('merges enum', function () {
      const result = mergeAndTest({
        allOf: [
          {},
          {
            enum: ['string', 'null', 'object', {}, [2], [1], null]
          },
          {
            enum: ['string', {}, [1]]
          },
          {
            enum: ['null', 'string', {}, [3], [1], null]
          }
        ]
      });

      expect(result).to.eql({
        enum: [[1], {}, 'string']
      });
    });

    it('throws if enum is incompatible', function () {
      expect(function () {
        mergeAndTest({
          allOf: [
            {},
            {
              enum: ['string', {}]
            },
            {
              enum: [{}, 'string']
            }
          ]
        });
      }).not.to.throw(/incompatible/);

      expect(function () {
        mergeAndTest({
          allOf: [
            {},
            {
              enum: ['string', {}]
            },
            {
              enum: [[], false]
            }
          ]
        });
      }).to.throw(/incompatible/);
    });

    it('merges const', function () {
      const result = mergeAndTest({
        allOf: [
          {},
          {
            const: ['string', {}]
          },
          {
            const: ['string', {}]
          }
        ]
      });

      expect(result).to.eql({
        const: ['string', {}]
      });
    });

    it('merges anyOf', function () {
      const result = mergeAndTest({
        allOf: [
          {
            anyOf: [
              {
                required: ['123']
              }
            ]
          },
          {
            anyOf: [
              {
                required: ['123']
              },
              {
                required: ['456']
              }
            ]
          }
        ]
      });

      expect(result).to.eql({
        anyOf: [
          {
            required: ['123']
          },
          {
            required: ['123', '456']
          }
        ]
      });
    });

    it('merges anyOf by finding valid combinations', function () {
      const result = mergeAndTest({
        allOf: [
          {
            anyOf: [
              {
                type: ['null', 'string', 'array']
              },
              {
                type: ['null', 'string', 'object']
              }
            ]
          },
          {
            anyOf: [
              {
                type: ['null', 'string']
              },
              {
                type: ['integer', 'object', 'null']
              }
            ]
          }
        ]
      });

      expect(result).to.eql({
        anyOf: [
          {
            type: ['null', 'string']
          },
          {
            type: 'null'
          },
          {
            type: ['object', 'null']
          }
        ]
      });
    });

    it.skip('extracts common logic', function () {
      const result = mergeAndTest({
        allOf: [
          {
            anyOf: [
              {
                type: ['null', 'string', 'array'],
                minLength: 5
              },
              {
                type: ['null', 'string', 'object'],
                minLength: 5
              }
            ]
          },
          {
            anyOf: [
              {
                type: ['null', 'string'],
                minLength: 5
              },
              {
                type: ['integer', 'object', 'null']
              }
            ]
          }
        ]
      });

      // TODO I think this is correct
      // TODO implement functionality
      expect(result).to.eql({
        type: 'null',
        minLength: 5,
        anyOf: [
          {
            type: 'string'
          }
        ]
      });
    });

    it.skip('merges anyOf into main schema if left with only one combination', function () {
      const result = mergeAndTest({
        required: ['abc'],
        allOf: [
          {
            anyOf: [
              {
                required: ['123']
              },
              {
                required: ['456']
              }
            ]
          },
          {
            anyOf: [
              {
                required: ['123']
              }
            ]
          }
        ]
      });

      expect(result).to.eql({
        required: ['abc', '123']
      });
    });

    it('merges nested allOf if inside singular anyOf', function () {
      const result = mergeAndTest({
        allOf: [
          {
            anyOf: [
              {
                required: ['123'],
                allOf: [
                  {
                    required: ['768']
                  }
                ]
              }
            ]
          },
          {
            anyOf: [
              {
                required: ['123']
              },
              {
                required: ['456']
              }
            ]
          }
        ]
      });

      expect(result).to.eql({
        anyOf: [
          {
            required: ['123', '768']
          },
          {
            required: ['123', '456', '768']
          }
        ]
      });
    });

    it('throws if no intersection at all', function () {
      expect(function () {
        mergeAndTest({
          allOf: [
            {
              anyOf: [
                {
                  type: ['object', 'string', 'null']
                }
              ]
            },
            {
              anyOf: [
                {
                  type: ['array', 'integer']
                }
              ]
            }
          ]
        });
      }).to.throw(/incompatible/);

      expect(function () {
        mergeAndTest({
          allOf: [
            {
              anyOf: [
                {
                  type: ['object', 'string', 'null']
                }
              ]
            },
            {
              anyOf: [
                {
                  type: ['array', 'integer']
                }
              ]
            }
          ]
        });
      }).to.throw(/incompatible/);
    });

    it('merges more complex oneOf', function () {
      const result = merger({
        allOf: [
          {
            oneOf: [
              {
                type: ['array', 'string', 'object'],
                required: ['123']
              },
              {
                required: ['abc']
              }
            ]
          },
          {
            oneOf: [
              {
                type: ['string']
              },
              {
                type: ['object', 'array'],
                required: ['abc']
              }
            ]
          }
        ]
      });

      expect(result).to.eql({
        oneOf: [
          {
            type: 'string',
            required: ['123']
          },
          {
            type: ['object', 'array'],
            required: ['123', 'abc']
          },
          {
            type: ['string'],
            required: ['abc']
          },
          {
            type: ['object', 'array'],
            required: ['abc']
          }
        ]
      });
    });

    it('merges nested allOf if inside singular oneOf', function () {
      const result = mergeAndTest({
        allOf: [
          {
            type: ['array', 'string', 'number'],
            oneOf: [
              {
                required: ['123'],
                allOf: [
                  {
                    required: ['768']
                  }
                ]
              }
            ]
          },
          {
            type: ['array', 'string']
          }
        ]
      });

      expect(result).to.eql({
        type: ['array', 'string'],
        oneOf: [
          {
            required: ['123', '768']
          }
        ]
      });
    });

    it('merges nested allOf if inside multiple oneOf', function () {
      const result = merger({
        allOf: [
          {
            type: ['array', 'string', 'number'],
            oneOf: [
              {
                type: ['array', 'object'],
                allOf: [
                  {
                    type: 'object'
                  }
                ]
              }
            ]
          },
          {
            type: ['array', 'string'],
            oneOf: [
              {
                type: 'string'
              },
              {
                type: 'object'
              }
            ]
          }
        ]
      });

      expect(result).to.eql({
        type: ['array', 'string'],
        oneOf: [
          {
            type: 'object'
          }
        ]
      });
    });

    it.skip('throws if no compatible when merging oneOf', function () {
      expect(function () {
        merger({
          allOf: [
            {},
            {
              oneOf: [
                {
                  required: ['123']
                }
              ]
            },
            {
              oneOf: [
                {
                  required: ['fdasfd']
                }
              ]
            }
          ]
        });
      }).to.throw(/incompatible/);

      expect(function () {
        merger({
          allOf: [
            {},
            {
              oneOf: [
                {
                  required: ['123']
                },
                {
                  properties: {
                    name: {
                      type: 'string'
                    }
                  }
                }
              ]
            },
            {
              oneOf: [
                {
                  required: ['fdasfd']
                }
              ]
            }
          ]
        });
      }).to.throw(/incompatible/);
    });

    // not ready to implement this yet
    it.skip('merges singular oneOf', function () {
      const result = merger({
        properties: {
          name: {
            type: 'string'
          }
        },
        allOf: [
          {
            properties: {
              name: {
                type: 'string',
                minLength: 10
              }
            }
          },
          {
            oneOf: [
              {
                required: ['123']
              },
              {
                properties: {
                  name: {
                    type: 'string',
                    minLength: 15
                  }
                }
              }
            ]
          },
          {
            oneOf: [
              {
                required: ['abc']
              },
              {
                properties: {
                  name: {
                    type: 'string',
                    minLength: 15
                  }
                }
              }
            ]
          }
        ]
      });

      expect(result).to.eql({
        properties: {
          name: {
            type: 'string',
            minLength: 15
          }
        }
      });
    });

    it('merges not using allOf', function () {
      const result = merger({
        allOf: [
          {
            not: {
              properties: {
                name: {
                  type: 'string'
                }
              }
            }
          },
          {
            not: {
              properties: {
                name: {
                  type: ['string', 'null']
                }
              }
            }
          }
        ]
      });

      expect(result).to.eql({
        not: {
          anyOf: [
            {
              properties: {
                name: {
                  type: 'string'
                }
              }
            },
            {
              properties: {
                name: {
                  type: ['string', 'null']
                }
              }
            }
          ]
        }
      });
    });

    it('extracts pattern from anyOf and oneOf using | operator in regexp');

    it.skip('merges multipleOf using allOf or direct assignment', function () {
      const result = mergeAndTest({
        allOf: [
          {
            title: 'foo',
            type: ['number', 'integer'],
            multipleOf: 2
          },
          {
            type: 'integer',
            multipleOf: 3
          }
        ]
      });

      expect(result).to.eql({
        type: 'integer',
        title: 'foo',
        allOf: [
          {
            multipleOf: 2
          },
          {
            multipleOf: 3
          }
        ]
      });

      const result2 = merger({
        allOf: [
          {
            multipleOf: 1
          }
        ]
      });

      expect(result2).to.eql({
        multipleOf: 1
      });
    });

    it('merges multipleOf by finding lowest common multiple (LCM)', function () {
      const result = mergeAndTest({
        allOf: [
          {},
          {
            multipleOf: 0.2,
            allOf: [
              {
                multipleOf: 2,
                allOf: [
                  {
                    multipleOf: 2,
                    allOf: [
                      {
                        multipleOf: 2,
                        allOf: [
                          {
                            multipleOf: 3,
                            allOf: [
                              {
                                multipleOf: 1.5,
                                allOf: [
                                  {
                                    multipleOf: 0.5
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            multipleOf: 0.3
          }
        ]
      });

      expect(result).to.eql({
        multipleOf: 6
      });

      expect(
        mergeAndTest({
          allOf: [
            {
              multipleOf: 4
            },
            {
              multipleOf: 15
            },
            {
              multipleOf: 3
            }
          ]
        })
      ).to.eql({
        multipleOf: 60
      });

      expect(
        mergeAndTest({
          allOf: [
            {
              multipleOf: 3
            },
            {
              multipleOf: 7
            },
            {
              multipleOf: 1
            }
          ]
        })
      ).to.eql({
        multipleOf: 21
      });

      expect(
        mergeAndTest({
          allOf: [
            {
              multipleOf: 5
            },
            {
              multipleOf: 2
            }
          ]
        })
      ).to.eql({
        multipleOf: 10
      });

      expect(
        mergeAndTest({
          allOf: [
            {
              multipleOf: 3
            },
            {
              multipleOf: 5
            },
            {
              multipleOf: 1
            }
          ]
        })
      ).to.eql({
        multipleOf: 15
      });

      expect(
        mergeAndTest({
          allOf: [
            {
              multipleOf: 3
            },
            {
              multipleOf: 7
            },
            {
              multipleOf: 1
            }
          ]
        })
      ).to.eql({
        multipleOf: 21
      });

      expect(
        mergeAndTest({
          allOf: [
            {
              multipleOf: 4
            },
            {
              multipleOf: 7
            },
            {
              multipleOf: 3
            }
          ]
        })
      ).to.eql({
        multipleOf: 84
      });

      expect(
        mergeAndTest({
          allOf: [
            {
              multipleOf: 2
            },
            {
              multipleOf: 65
            },
            {
              multipleOf: 1
            }
          ]
        })
      ).to.eql({
        multipleOf: 130
      });

      expect(
        mergeAndTest({
          allOf: [
            {
              multipleOf: 100000
            },
            {
              multipleOf: 1000000
            },
            {
              multipleOf: 500000
            }
          ]
        })
      ).to.eql({
        multipleOf: 1000000
      });
    });
  });

  describe('merging arrays', function () {
    it('merges required object', function () {
      expect(
        mergeAndTest({
          required: ['prop2'],
          allOf: [
            {
              required: ['prop2', 'prop1']
            }
          ]
        })
      ).to.eql({
        required: ['prop1', 'prop2']
      });
    });

    it('merges default value', function () {
      expect(
        merger({
          default: [
            'prop2',
            {
              prop1: 'foo'
            }
          ],
          allOf: [
            {
              default: ['prop2', 'prop1']
            }
          ]
        })
      ).to.eql({
        default: [
          'prop2',
          {
            prop1: 'foo'
          }
        ]
      });
    });

    it('merges default value', function () {
      expect(
        merger({
          default: {
            foo: 'bar'
          },
          allOf: [
            {
              default: ['prop2', 'prop1']
            }
          ]
        })
      ).to.eql({
        default: {
          foo: 'bar'
        }
      });
    });
  });

  describe('merging objects', function () {
    it('merges child objects', function () {
      expect(
        mergeAndTest({
          properties: {
            name: {
              title: 'Name',
              type: 'string'
            }
          },
          allOf: [
            {
              properties: {
                name: {
                  title: 'allof1',
                  type: 'string'
                },
                added: {
                  type: 'integer'
                }
              }
            },
            {
              properties: {
                name: {
                  type: 'string'
                }
              }
            }
          ]
        })
      ).to.eql({
        properties: {
          name: {
            title: 'Name',
            type: 'string'
          },
          added: {
            type: 'integer'
          }
        }
      });
    });

    it('merges boolean schemas', function () {
      expect(
        mergeAndTest({
          properties: {
            name: true
          },
          allOf: [
            {
              properties: {
                name: {
                  title: 'allof1',
                  type: 'string'
                },
                added: {
                  type: 'integer'
                }
              }
            },
            {
              properties: {
                name: {
                  type: 'string',
                  minLength: 5
                }
              }
            }
          ]
        })
      ).to.eql({
        properties: {
          name: {
            title: 'allof1',
            type: 'string',
            minLength: 5
          },
          added: {
            type: 'integer'
          }
        }
      });

      expect(
        mergeAndTest({
          properties: {
            name: false
          },
          allOf: [
            {
              properties: {
                name: {
                  title: 'allof1',
                  type: 'string'
                },
                added: {
                  type: 'integer'
                }
              }
            },
            {
              properties: {
                name: true
              }
            }
          ]
        })
      ).to.eql({
        properties: {
          name: false,
          added: {
            type: 'integer'
          }
        }
      });

      expect(
        merger({
          allOf: [true, false]
        })
      ).to.eql(false);

      expect(
        mergeAndTest({
          properties: {
            name: true
          },
          allOf: [
            {
              properties: {
                name: false,
                added: {
                  type: 'integer'
                }
              }
            },
            {
              properties: {
                name: true
              }
            }
          ]
        })
      ).to.eql({
        properties: {
          name: false,
          added: {
            type: 'integer'
          }
        }
      });
    });

    it('merges all allOf', function () {
      expect(
        mergeAndTest({
          properties: {
            name: {
              allOf: [
                {
                  pattern: '^.+$'
                }
              ]
            }
          },
          allOf: [
            {
              properties: {
                name: true,
                added: {
                  type: 'integer',
                  title: 'pri1',
                  allOf: [
                    {
                      title: 'pri2',
                      type: ['string', 'integer'],
                      minimum: 15,
                      maximum: 10
                    }
                  ]
                }
              },
              allOf: [
                {
                  properties: {
                    name: true,
                    added: {
                      type: 'integer',
                      minimum: 5
                    }
                  },
                  allOf: [
                    {
                      properties: {
                        added: {
                          title: 'pri3',
                          type: 'integer',
                          minimum: 10
                        }
                      }
                    }
                  ]
                }
              ]
            },
            {
              properties: {
                name: true,
                added: {
                  minimum: 7
                }
              }
            }
          ]
        })
      ).to.eql({
        properties: {
          name: {
            pattern: '^.+$'
          },
          added: {
            type: 'integer',
            title: 'pri1',
            minimum: 15,
            maximum: 10
          }
        }
      });
    });
  });

  describe.skip('merging definitions', function () {
    it('merges circular', function () {
      const schema = {
        properties: {
          person: {
            properties: {
              name: {
                type: 'string',
                minLength: 8
              }
            },
            allOf: [
              {
                properties: {
                  name: {
                    minLength: 5,
                    maxLength: 10
                  }
                },
                allOf: [
                  {
                    properties: {
                      prop1: {
                        minLength: 7
                      }
                    }
                  }
                ]
              }
            ]
          }
        }
      };

      schema.properties.person.properties.child = schema.properties.person;

      const expected = {
        person: {
          properties: {
            name: {
              minLength: 8,
              maxLength: 10,
              type: 'string'
            },
            prop1: {
              minLength: 7
            }
          }
        }
      };

      expected.person.properties.child = expected.person;

      const result = mergeAndTest(schema);

      expect(result).to.eql({
        properties: expected
      });
    });

    it('merges any definitions and circular', function () {
      const schema = {
        properties: {
          person: {
            $ref: '#/definitions/person'
          }
        },
        definitions: {
          person: {
            properties: {
              name: {
                type: 'string',
                minLength: 8
              },
              child: {
                $ref: '#/definitions/person'
              }
            },
            allOf: [
              {
                properties: {
                  name: {
                    minLength: 5,
                    maxLength: 10
                  }
                },
                allOf: [
                  {
                    properties: {
                      prop1: {
                        minLength: 7
                      }
                    }
                  }
                ]
              }
            ]
          }
        }
      };

      return dereference(schema).then(function (dereferenced) {
        const expected = {
          person: {
            properties: {
              name: {
                minLength: 8,
                maxLength: 10,
                type: 'string'
              },
              prop1: {
                minLength: 7
              }
            }
          }
        };

        expected.person.properties.child = expected.person;

        const result = mergeAndTest(schema);

        expect(result).to.eql({
          properties: expected,
          definitions: expected
        });

        expect(result).to.equal(dereferenced);

        expect(result.properties.person.properties.child).to.equal(
          result.definitions.person.properties.child
        );
        expect(result.properties.person.properties.child).to.equal(
          dereferenced.properties.person
        );
      });
    });
  });

  describe('dependencies', function () {
    it('merges simliar schemas', function () {
      const result = mergeAndTest({
        dependencies: {
          foo: {
            type: ['string', 'null', 'integer'],
            allOf: [
              {
                minimum: 5
              }
            ]
          },
          bar: ['prop1', 'prop2']
        },
        allOf: [
          {
            dependencies: {
              foo: {
                type: ['string', 'null'],
                allOf: [
                  {
                    minimum: 7
                  }
                ]
              },
              bar: ['prop4']
            }
          }
        ]
      });

      expect(result).to.eql({
        dependencies: {
          foo: {
            type: ['string', 'null'],
            minimum: 7
          },
          bar: ['prop1', 'prop2', 'prop4']
        }
      });
    });

    it('merges mixed mode dependency', function () {
      const result = merger({
        dependencies: {
          bar: {
            type: ['string', 'null', 'integer', 'object'],
            required: ['abc']
          }
        },
        allOf: [
          {
            dependencies: {
              bar: ['prop4']
            }
          }
        ]
      });

      expect(result).to.eql({
        dependencies: {
          bar: {
            type: ['string', 'null', 'integer', 'object'],
            required: ['abc', 'prop4']
          }
        }
      });
    });
  });

  describe('propertyNames', function () {
    it('merges simliar schemas', function () {
      const result = mergeAndTest({
        propertyNames: {
          type: 'string',
          allOf: [
            {
              minLength: 5
            }
          ]
        },
        allOf: [
          {
            propertyNames: {
              type: 'string',
              pattern: 'abc.*',
              allOf: [
                {
                  maxLength: 7
                }
              ]
            }
          }
        ]
      });

      expect(result).to.eql({
        propertyNames: {
          type: 'string',
          pattern: 'abc.*',
          minLength: 5,
          maxLength: 7
        }
      });
    });
  });
});
