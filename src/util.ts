import {
  flattenDeep as lodashFlattenDeep,
  isEqual,
  isPlainObject,
  sortBy,
  uniq as lodashUniq,
  uniqWith as lodashUniqWith,
  without as lodashWithout
} from 'lodash';
import type { flatten as lodashFlatten } from 'lodash';
import { itemsRelated, propertyRelated } from './constants';

// like _.flatten but maintain object identity if nothing changes
export type { lodashFlatten };
export const flatten: typeof lodashFlatten = function flattenCoW(arr) {
  let changed = false;
  const copy = [];
  for (const val of arr as any[]) {
    if (Array.isArray(val)) {
      changed = true;
      copy.push(...val);
    } else {
      copy.push(val);
    }
  }
  return changed ? copy : arr;
} as typeof lodashFlatten;

// like _.flattenDeep but maintain object identity if nothing changes
export type { lodashFlattenDeep };
export const flattenDeep: typeof lodashFlattenDeep = function flattenDeepCoW(
  arr: Parameters<typeof lodashFlattenDeep>[0]
) {
  for (const val of arr as any[]) {
    if (Array.isArray(val)) {
      return lodashFlattenDeep(arr);
    }
  }
  return arr;
} as typeof lodashFlattenDeep;

// like _.uniq but maintain object identity if nothing changes
export type { lodashUniq };
export const uniq: typeof lodashUniq = function uniqCoW(
  arr: Parameters<typeof lodashUniq>[0]
) {
  const res = lodashUniq(arr);
  return res.length === arr.length ? arr : res;
} as typeof lodashUniq;

// like _.uniqWith but maintain object identity if nothing changes
export type { lodashUniqWith };
export const uniqWith: typeof lodashUniqWith = function uniqWithCoW(
  arr,
  ...rest
) {
  const res = lodashUniqWith(arr, ...rest);
  return res.length === arr.length ? arr : res;
} as typeof lodashUniqWith;

// like _.without but maintain object identity if nothing changes
export type { lodashWithout };
const without: typeof lodashWithout = function withoutCoW(arr, ...rest) {
  const res = lodashWithout(arr, ...rest);
  return res.length === arr.length ? arr : res;
} as typeof lodashWithout;

export const withoutArr = (arr, ...rest) =>
  without.apply(null, [arr].concat(flatten(rest)));
export const isPropertyRelated = (key) => contains(propertyRelated, key);
export const isItemsRelated = (key) => contains(itemsRelated, key);
export const contains = (arr, val) => arr.indexOf(val) !== -1;
export const isEmptySchema = (obj) =>
  !keys(obj).length && obj !== false && obj !== true;
export const isSchema = (val) =>
  isPlainObject(val) || val === true || val === false;
export const isFalse = (val) => val === false;
export const isTrue = (val) => val === true;
export const schemaResolver = (compacted, key, mergeSchemas) =>
  mergeSchemas(compacted);
export const stringArray = (values) => sortBy(uniq(flattenDeep(values)));
export const notUndefined = (val) => val !== undefined;
export const allUniqueKeys = <T>(arr: T[]): Array<keyof T> =>
  uniq(flattenDeep(arr.map(keys)));

// resolvers
export const first = (compacted) => compacted[0];
export const required = (compacted) => stringArray(compacted);
export const maximumValue = (compacted) => Math.max.apply(Math, compacted);
export const minimumValue = (compacted) => Math.min.apply(Math, compacted);
export const uniqueItems = (compacted) => compacted.some(isTrue);
export const examples = (compacted) => uniqWith(flatten(compacted), isEqual);

export function keys<T>(obj: T): Array<keyof T> {
  if (isPlainObject(obj) || Array.isArray(obj)) {
    return Object.keys(obj) as Array<keyof T>;
  } else {
    return [];
  }
}
