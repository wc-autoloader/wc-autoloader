import { load } from "./webc.js";
export const DEFAULT_KEY = "*";
export const WEBC_KEY = "webc";
export const WEBC_LOADER = {
    postfix: ".webc.js",
    loader: load
};
const DEFAULT_CONFIG = {
    scanImportmap: true,
    loaders: {
        [WEBC_KEY]: WEBC_LOADER,
        [DEFAULT_KEY]: WEBC_KEY
    },
    observable: true
};
export const config = DEFAULT_CONFIG;
