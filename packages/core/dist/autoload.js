import { DEFAULT_KEY } from "./config.js";
const failedTags = new Set();
const loadingTags = new Set();
export function resetState() {
    failedTags.clear();
    loadingTags.clear();
}
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
function getUndefinedTagInfos(elements) {
    const tagInfos = new Array();
    const duplicateChecks = new Set();
    for (const element of elements) {
        const tagName = element.tagName;
        if (duplicateChecks.has(tagName)) {
            continue;
        }
        duplicateChecks.add(tagName);
        const tagInfo = getTagInfoFromElement(element);
        if (failedTags.has(tagInfo.name)) {
            continue;
        }
        if (loadingTags.has(tagInfo.name)) {
            continue;
        }
        tagInfos.push(tagInfo);
    }
    return tagInfos;
}
export async function lazyLoad(root, prefixMap, loaders) {
    let elements = root.querySelectorAll(':not(:defined)');
    let undefinedTagInfos = getUndefinedTagInfos(Array.from(elements));
    while (undefinedTagInfos.length > 0) {
        for (const tagInfo of undefinedTagInfos) {
            let info = matchNameSpace(tagInfo.name, prefixMap);
            if (info === null) {
                throw new Error("No matching namespace found for lazy loaded component: " + tagInfo.name);
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
                throw new Error("Loader redirection is not supported for lazy loaded components: " + tagInfo.name);
            }
            loadingTags.add(tagInfo.name);
            let file = tagInfo.name.slice(info.prefix.length + 1);
            if (file === "") {
                throw new Error("Invalid component name for lazy loaded component: " + tagInfo.name);
            }
            const path = info.key + file + loader.postfix;
            try {
                const componentConstructor = await loader.loader(path);
                if (componentConstructor !== null) {
                    if (tagInfo.extends === null) {
                        customElements.define(tagInfo.name, componentConstructor);
                    }
                    else {
                        customElements.define(tagInfo.name, componentConstructor, { extends: tagInfo.extends });
                    }
                }
                else {
                    throw new Error("Loader returned null for component: " + tagInfo.name);
                }
            }
            catch (e) {
                console.error(`Failed to lazy load component '${tagInfo.name}':`, e);
                failedTags.add(tagInfo.name);
            }
            finally {
                loadingTags.delete(tagInfo.name);
            }
        }
        elements = root.querySelectorAll(':not(:defined)');
        undefinedTagInfos = getUndefinedTagInfos(Array.from(elements));
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
