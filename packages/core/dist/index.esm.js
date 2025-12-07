const COMPONENT_KEYWORD = "@components/";
function loadImportmap() {
    const importmap = { imports: {} };
    document.querySelectorAll('script[type="importmap"]').forEach((script) => {
        try {
            const json = JSON.parse(script.innerHTML);
            if (json.imports) {
                importmap.imports = Object.assign(importmap.imports, json.imports);
            }
        }
        catch (e) {
            throw new Error("Failed to parse importmap JSON: " + e);
        }
    });
    return Object.keys(importmap.imports).length > 0
        ? importmap
        : null;
}
function getKeyInfoFromImportmapKey(key) {
    if (key.startsWith(COMPONENT_KEYWORD)) {
        if (key.endsWith("/")) {
            const prefixWithLoader = key.slice(COMPONENT_KEYWORD.length, key.length - 1);
            const [prefix, loaderKey] = prefixWithLoader.split("|", 2);
            if (prefix === "") {
                throw new Error("Invalid importmap key: " + key);
            }
            return {
                key,
                prefix: prefix.replaceAll("/", "-").toLowerCase(),
                loaderKey: loaderKey ?? null,
                isNameSpaced: true
            };
        }
        else {
            const tagNamePart = key.slice(COMPONENT_KEYWORD.length);
            const [tagName, loaderKeyPart] = tagNamePart.split("|", 2);
            const [loaderKey, extendsText] = (loaderKeyPart ?? "").split(",", 2);
            if (tagName === "") {
                throw new Error("Invalid importmap key: " + key);
            }
            return {
                key,
                tagName: tagName.replaceAll("/", "-").toLowerCase(),
                loaderKey: loaderKey || null,
                extends: extendsText || null,
                isNameSpaced: false
            };
        }
    }
    return null;
}
function buildMap(importmap) {
    const prefixMap = {};
    const loadMap = {};
    for (const [key, value] of Object.entries(importmap.imports)) {
        const keyInfo = getKeyInfoFromImportmapKey(key);
        if (keyInfo === null) {
            continue;
        }
        if (keyInfo.isNameSpaced) {
            prefixMap[keyInfo.prefix] = keyInfo;
        }
        else {
            loadMap[keyInfo.tagName] = keyInfo;
        }
    }
    return { prefixMap, loadMap };
}

async function load(path) {
    const module = await import(path);
    return module.default;
}

const DEFAULT_KEY = "*";
const VANILLA_KEY = "vanilla";
const VANILLA_LOADER = {
    postfix: ".js",
    loader: load
};
const DEFAULT_CONFIG = {
    scanImportmap: true,
    loaders: {
        [VANILLA_KEY]: VANILLA_LOADER,
        [DEFAULT_KEY]: VANILLA_KEY
    },
    observable: true
};
const config = DEFAULT_CONFIG;

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
async function lazyLoad(root, prefixMap, loaders) {
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
async function eagerLoad(loadMap, loaders) {
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

async function registerHandler() {
    const importmap = loadImportmap(); // 事前に importmap を読み込んでおく
    if (importmap === null) {
        return;
    }
    const { prefixMap, loadMap } = buildMap(importmap);
    // 先にeager loadを実行すると、DOMContentLoadedイベントが発生しないことがあるため、後に実行する
    document.addEventListener("DOMContentLoaded", async () => {
        if (Object.keys(prefixMap).length === 0) {
            return;
        }
        try {
            await lazyLoad(document, prefixMap, config.loaders);
        }
        catch (e) {
            throw new Error("Failed to lazy load components: " + e);
        }
        if (!config.observable) {
            return;
        }
        const mo = new MutationObserver(async () => {
            try {
                await lazyLoad(document, prefixMap, config.loaders);
            }
            catch (e) {
                throw new Error("Failed to lazy load components: " + e);
            }
        });
        mo.observe(document.documentElement, { childList: true, subtree: true });
    });
    try {
        await eagerLoad(loadMap, config.loaders);
    }
    catch (e) {
        throw new Error("Failed to eager load components: " + e);
    }
}

export { DEFAULT_KEY, VANILLA_KEY, VANILLA_LOADER, buildMap, config, eagerLoad, lazyLoad, load, loadImportmap, registerHandler };
//# sourceMappingURL=index.esm.js.map
