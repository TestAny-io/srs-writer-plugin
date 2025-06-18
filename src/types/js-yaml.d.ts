declare module 'js-yaml' {
  export function load(str: string, options?: any): any;
  export function dump(obj: any, options?: any): string;
  export function loadAll(str: string, iterator?: (doc: any) => void, options?: any): any[];
  export function dumpAll(objects: any[], options?: any): string;
  export function safeLoad(str: string, options?: any): any;
  export function safeDump(obj: any, options?: any): string;
  export function safeLoadAll(str: string, iterator?: (doc: any) => void, options?: any): any[];
  export function safeDumpAll(objects: any[], options?: any): string;
}
