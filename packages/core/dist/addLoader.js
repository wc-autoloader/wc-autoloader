import { config } from "./config.js";
export function addLoader(key, loader) {
    config.loaders[key] = loader;
}
