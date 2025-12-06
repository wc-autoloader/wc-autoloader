export { registerHandler } from "./handler.js";
export { lazyLoad, eagerLoad } from "./autoload.js";
export { buildMap, loadImportmap } from "./importmap.js";
export { load } from "./webc.js";
export {
	config,
	DEFAULT_KEY,
	WEBC_KEY,
	WEBC_LOADER
} from "./config.js";
export type {
	IEagerLoadInfo,
	IConfig,
	IImportMap,
	IKeyInfo,
	ILoader,
	ILoadMap,
	INameSpaceInfo,
	IPrefixMap,
	ITagInfo,
	LoaderFunction
} from "./types.js";
