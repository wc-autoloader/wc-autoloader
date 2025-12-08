import { IEagerLoadInfo, ILoader, IPrefixMap } from "./types.js";
export declare function resetState(): void;
export declare function lazyLoad(root: Document | ShadowRoot, prefixMap: IPrefixMap, loaders: Record<string, ILoader | string>): Promise<void>;
export declare function eagerLoad(loadMap: Record<string, IEagerLoadInfo>, loaders: Record<string, ILoader | string>): Promise<void>;
//# sourceMappingURL=autoload.d.ts.map