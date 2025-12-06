import { DEFAULT_KEY } from "./config.js";
const failedTags = new Set();
const loadingTags = new Set();
function getTagInfoFromElement(e) {
    let elementTagName = e.tagName.toLowerCase();
    let name;
    let extendsName;
    if (elementTagName.includes("-")) {
        name = elementTagName;
        extendsName = null;
    }
    else {
        const tagName = e.getAttribute("is");
        if (tagName === null) {
            throw new Error("Custom element without a dash or 'is' attribute found: " + elementTagName);
        }
        if (!tagName.includes("-")) {
            throw new Error("Custom element 'is' attribute without a dash found: " + elementTagName);
        }
        name = tagName;
        extendsName = elementTagName;
    }
    return { name, extends: extendsName };
}
function matchNameSpace(tagName, prefixMap) {
    for (const [prefix, info] of Object.entries(prefixMap)) {
        if (tagName.startsWith(prefix + "-")) {
            return info;
        }
    }
    return null;
}
export async function lazyLoad(root, prefixMap, loaders) {
    let elements = root.querySelectorAll(':not(:defined)');
    const duplicateCheck = new Set(); // UpperCase tag names
    for (const element of elements) {
        const tagName = element.tagName;
        if (duplicateCheck.has(tagName)) {
            continue;
        }
        duplicateCheck.add(tagName);
        const { name, extends: extendsName } = getTagInfoFromElement(element);
        if (failedTags.has(name)) {
            continue;
        }
        if (loadingTags.has(name)) {
            continue;
        }
        let info = matchNameSpace(name, prefixMap);
        if (info === null) {
            throw new Error("No matching namespace found for lazy loaded component: " + name);
        }
        let loader;
        if (info.loaderKey === null || info.loaderKey === DEFAULT_KEY || info.loaderKey === "") {
            loader = loaders[DEFAULT_KEY];
            if (typeof loader === "string") {
                loader = loaders[loader];
            }
        }
        else {
            loader = loaders[info.loaderKey];
        }
        if (typeof loader === "string") {
            throw new Error("Loader redirection is not supported for eager loaded components: " + tagName);
        }
        loadingTags.add(name);
        let file = name.slice(info.prefix.length + 1);
        if (file === "") {
            throw new Error("Invalid component name for lazy loaded component: " + name);
        }
        const path = info.key + file + loader.postfix;
        try {
            const componentConstructor = await loader.loader(path);
            if (componentConstructor !== null) {
                if (extendsName === null) {
                    customElements.define(name, componentConstructor);
                }
                else {
                    customElements.define(name, componentConstructor, { extends: extendsName });
                }
            }
        }
        catch (e) {
            if (!failedTags.has(name)) {
                console.error(`Failed to lazy load component '${name}':`, e);
                failedTags.add(name);
            }
        }
        finally {
            loadingTags.delete(name);
        }
    }
}
export async function eagerLoad(loadMap, loaders) {
    for (const [tagName, info] of Object.entries(loadMap)) {
        let loader;
        if (info.loaderKey === null || info.loaderKey === DEFAULT_KEY || info.loaderKey === "") {
            loader = loaders[DEFAULT_KEY];
            if (typeof loader === "string") {
                loader = loaders[loader];
            }
        }
        else {
            loader = loaders[info.loaderKey];
        }
        if (typeof loader === "string") {
            throw new Error("Loader redirection is not supported for eager loaded components: " + tagName);
        }
        try {
            const componentConstructor = await loader.loader(info.key);
            if (componentConstructor !== null) {
                if (info.extends === null) {
                    customElements.define(tagName, componentConstructor);
                }
                else {
                    customElements.define(tagName, componentConstructor, { extends: info.extends });
                }
            }
        }
        catch (e) {
            if (!failedTags.has(tagName)) {
                console.error(`Failed to eager load component '${tagName}':`, e);
                failedTags.add(tagName);
            }
        }
    }
}
