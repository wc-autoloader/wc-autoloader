import { DEFAULT_KEY } from "./config.js";
import { IEagerLoadInfo, ILoader, INameSpaceInfo, IPrefixMap, ITagInfo } from "./types.js";

const failedTags = new Set<string>();
const loadingTags = new Set<string>();

const EXTENDS_MAP = new Map<any, string>();

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
  ] as const;

  map.forEach(([cls, tag]) => {
    if (typeof cls !== "undefined") {
      EXTENDS_MAP.set(cls, tag);
    }
  });
}

export function resetState() {
  failedTags.clear();
  loadingTags.clear();
}

function getTagInfoFromElement(e: Element): ITagInfo {
  const elementTagName = e.tagName.toLowerCase();
  let name;
  let extendsName;
  if (elementTagName.includes("-")) {
    name = elementTagName;
    extendsName = null;
  } else {
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

function matchNameSpace(tagName: string, prefixMap: IPrefixMap): INameSpaceInfo | null {
  for (const [prefix, info] of Object.entries(prefixMap)) {
    if (tagName.startsWith(prefix + "-")) {
      return info;
    }
  }
  return null;
}

function getUndefinedTagInfos(elements:Array<Element>): Array<ITagInfo> {
  const tagInfos = new Array<ITagInfo>();
  const duplicateChecks = new Set<string>();
  for(const element of elements) {
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

function resolveLoader(
  path: string,
  loaderKey: string | null,
  loaders: Record<string, ILoader | string>
): ILoader {
  let loader: ILoader | string;

  if (loaderKey === null || loaderKey === DEFAULT_KEY || loaderKey === "") {
    // Try to resolve by postfix
    let resolvedLoader: ILoader | null = null;
    
    const candidates: ILoader[] = [];
    for (const [key, l] of Object.entries(loaders)) {
      if (key === DEFAULT_KEY) continue;
      const currentLoader = typeof l === "string" ? loaders[l] : l;
      if (typeof currentLoader === "string") continue; // Should not happen if config is correct
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
    } else {
      loader = loaders[DEFAULT_KEY];
      if (typeof loader === "string") {
        loader = loaders[loader];
      }
    }
  } else {
    loader = loaders[loaderKey];
  }

  if (typeof loader === "string") {
    throw new Error("Loader redirection is not supported here");
  }
  return loader;
}

function resolveExtends(componentConstructor: CustomElementConstructor): string | null {
  for (const [cls, tag] of EXTENDS_MAP) {
    if (componentConstructor.prototype instanceof cls) {
      return tag;
    }
  }
  return null;
}

export async function lazyLoad(
  root: Document | ShadowRoot, 
  prefixMap: IPrefixMap,
  loaders: Record<string, ILoader | string>
): Promise<void> {
  let elements = root.querySelectorAll(':not(:defined)');
  let undefinedTagInfos = getUndefinedTagInfos(Array.from(elements));
  while(undefinedTagInfos.length > 0) {
    for(const tagInfo of undefinedTagInfos) {
      const info: INameSpaceInfo | null = matchNameSpace(tagInfo.name, prefixMap);
      if (info === null) {
        throw new Error("No matching namespace found for lazy loaded component: " + tagInfo.name);
      }
      
      let loader: ILoader;
      try {
        loader = resolveLoader("", info.loaderKey, loaders);
      } catch (_e) {
        throw new Error("Loader redirection is not supported for lazy loaded components: " + tagInfo.name);
      }

      loadingTags.add(tagInfo.name);
      const file: string = tagInfo.name.slice(info.prefix.length + 1);
      if (file === "") {
        throw new Error("Invalid component name for lazy loaded component: " + tagInfo.name);
      }
      const path = info.key + file + loader.postfix;
      try {
        const componentConstructor = await loader.loader(path);
        if (componentConstructor !== null) {
          if (tagInfo.extends === null) {
            customElements.define(tagInfo.name, componentConstructor);
          } else {
            customElements.define(tagInfo.name, componentConstructor, { extends: tagInfo.extends });
          }
        } else {
          throw new Error("Loader returned null for component: " + tagInfo.name);
        }
      } catch(e) {
        console.error(`Failed to lazy load component '${tagInfo.name}':`, e);
        failedTags.add(tagInfo.name);
      } finally {
        loadingTags.delete(tagInfo.name);
      }

    }
    elements = root.querySelectorAll(':not(:defined)');
    undefinedTagInfos = getUndefinedTagInfos(Array.from(elements));
  }
}

export async function eagerLoad(
  loadMap: Record<string, IEagerLoadInfo>, 
  loaders: Record<string, ILoader | string>
): Promise<void> {
  for(const [tagName, info] of Object.entries(loadMap)) {
    let loader: ILoader;
    try {
      loader = resolveLoader(info.key, info.loaderKey, loaders);
    } catch (_e) {
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
        } else {
          customElements.define(tagName, componentConstructor, { extends: extendsName });
        }
      }
    } catch(e) {
      if (!failedTags.has(tagName)) {
        console.error(`Failed to eager load component '${tagName}':`, e);
        failedTags.add(tagName);
      }
    }
  }
}
