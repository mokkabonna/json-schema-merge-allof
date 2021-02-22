type notUndefined = boolean | number | string | object | null | notUndefined[]
export type Resolver<Schema> = (
  values: Schema[],
  path: string[],
  mergeSchemas: (schemas: Schema[]) => Schema,
  options: MergerOptions
) => notUndefined

type PropertiesMerger<Schema> = {
  properties: Resolver<Schema>
  patternProperties: Resolver<Schema>
  additionalProperties: Resolver<Schema>
}
type ItemsMerger<Schema> = {
  items: Resolver<Schema>
  additionalItems: Resolver<Schema>
}
export type CombinedResolver<Schema, Mergers> = (
  values: Schema[],
  path: string[],
  mergers: Mergers,
  options: MergerOptions
) => notUndefined
export interface Resolvers<Schema> {
  [key: string]: Resolver<Schema>
  properties?: CombinedResolver<Schema, PropertiesMerger>
  items?: CombinedResolver<Schema, ItemsMerger>
  defaultResolver?: Resolver<Schema>
}

export interface MergerOptions<Schema> {
  /**
   * @default false
   */
  ignoreAdditionalProperties?: boolean
  resolvers?: Resolvers<Schema>
  /**
   * @default true
   */
  deep?: boolean
}

declare function merger<Schema> (
  rootSchema: Schema,
  options?: MergerOptions<Schema>
): Schema

export = merger
