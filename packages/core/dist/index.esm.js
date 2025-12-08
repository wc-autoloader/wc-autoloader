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
    for (const [key, _value] of Object.entries(importmap.imports)) {
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
const EXTENDS_MAP = new Map();
if (typeof window !== "undefined") {
    const map = [
        [HTMLButtonElement, "button"],
        [HTMLInputElement, "input"],
        [HTMLAnchorElement, "a"],
        [HTMLImageElement, "img"],
        [HTMLDivElement, "div"],
        [HTMLSpanElement, "span"],
        [HTMLParagraphElement, "p"],
        [HTMLUListElement, "ul"],
        [HTMLOListElement, "ol"],
        [HTMLLIElement, "li"],
        [HTMLTableElement, "table"],
        [HTMLFormElement, "form"],
        [HTMLLabelElement, "label"],
        [HTMLSelectElement, "select"],
        [HTMLTextAreaElement, "textarea"],
        [HTMLHeadingElement, "h1"],
        [HTMLQuoteElement, "blockquote"],
        [HTMLPreElement, "pre"],
        [HTMLBRElement, "br"],
        [HTMLHRElement, "hr"],
        [HTMLModElement, "ins"],
        [HTMLTableCaptionElement, "caption"],
        [HTMLTableColElement, "col"],
        [HTMLTableSectionElement, "tbody"],
        [HTMLTableRowElement, "tr"],
        [HTMLTableCellElement, "td"],
        [HTMLFieldSetElement, "fieldset"],
        [HTMLLegendElement, "legend"],
        [HTMLDListElement, "dl"],
        [HTMLOptGroupElement, "optgroup"],
        [HTMLOptionElement, "option"],
        [HTMLStyleElement, "style"],
        [HTMLScriptElement, "script"],
        [HTMLTemplateElement, "template"],
        [HTMLCanvasElement, "canvas"],
        [HTMLIFrameElement, "iframe"],
        [HTMLObjectElement, "object"],
        [HTMLEmbedElement, "embed"],
        [HTMLVideoElement, "video"],
        [HTMLAudioElement, "audio"],
        [HTMLTrackElement, "track"],
        [HTMLMapElement, "map"],
        [HTMLAreaElement, "area"],
        [HTMLSourceElement, "source"],
        [HTMLParamElement, "param"],
        [HTMLMeterElement, "meter"],
        [HTMLProgressElement, "progress"],
        [HTMLOutputElement, "output"],
        [HTMLDetailsElement, "details"],
        [HTMLDialogElement, "dialog"],
        [HTMLMenuElement, "menu"],
        [HTMLSlotElement, "slot"],
        [HTMLTimeElement, "time"],
        [HTMLDataElement, "data"],
        [HTMLPictureElement, "picture"],
    ];
    map.forEach(([cls, tag]) => {
        if (typeof cls !== "undefined") {
            EXTENDS_MAP.set(cls, tag);
        }
    });
}
function getTagInfoFromElement(e) {
    const elementTagName = e.tagName.toLowerCase();
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
function resolveLoader(path, loaderKey, loaders) {
    let loader;
    if (loaderKey === null || loaderKey === DEFAULT_KEY || loaderKey === "") {
        // Try to resolve by postfix
        let resolvedLoader = null;
        const candidates = [];
        for (const [key, l] of Object.entries(loaders)) {
            if (key === DEFAULT_KEY)
                continue;
            const currentLoader = typeof l === "string" ? loaders[l] : l;
            if (typeof currentLoader === "string")
                continue; // Should not happen if config is correct
            candidates.push(currentLoader);
        }
        // Sort by postfix length descending to match longest extension first
        candidates.sort((a, b) => b.postfix.length - a.postfix.length);
        for (const currentLoader of candidates) {
            if (path.endsWith(currentLoader.postfix)) {
                resolvedLoader = currentLoader;
                break;
            }
        }
        if (resolvedLoader) {
            loader = resolvedLoader;
        }
        else {
            loader = loaders[DEFAULT_KEY];
            if (typeof loader === "string") {
                loader = loaders[loader];
            }
        }
    }
    else {
        loader = loaders[loaderKey];
    }
    if (typeof loader === "string") {
        throw new Error("Loader redirection is not supported here");
    }
    return loader;
}
function resolveExtends(componentConstructor) {
    for (const [cls, tag] of EXTENDS_MAP) {
        if (componentConstructor.prototype instanceof cls) {
            return tag;
        }
    }
    return null;
}
async function lazyLoad(root, prefixMap, loaders) {
    let elements = root.querySelectorAll(':not(:defined)');
    let undefinedTagInfos = getUndefinedTagInfos(Array.from(elements));
    while (undefinedTagInfos.length > 0) {
        for (const tagInfo of undefinedTagInfos) {
            const info = matchNameSpace(tagInfo.name, prefixMap);
            if (info === null) {
                throw new Error("No matching namespace found for lazy loaded component: " + tagInfo.name);
            }
            let loader;
            try {
                loader = resolveLoader("", info.loaderKey, loaders);
            }
            catch (_e) {
                throw new Error("Loader redirection is not supported for lazy loaded components: " + tagInfo.name);
            }
            loadingTags.add(tagInfo.name);
            const file = tagInfo.name.slice(info.prefix.length + 1);
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
async function eagerLoad(loadMap, loaders) {
    for (const [tagName, info] of Object.entries(loadMap)) {
        let loader;
        try {
            loader = resolveLoader(info.key, info.loaderKey, loaders);
        }
        catch (_e) {
            throw new Error("Loader redirection is not supported for eager loaded components: " + tagName);
        }
        try {
            const componentConstructor = await loader.loader(info.key);
            if (componentConstructor !== null) {
                let extendsName = info.extends;
                if (extendsName === null) {
                    extendsName = resolveExtends(componentConstructor);
                }
                if (extendsName === null) {
                    customElements.define(tagName, componentConstructor);
                }
                else {
                    customElements.define(tagName, componentConstructor, { extends: extendsName });
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
