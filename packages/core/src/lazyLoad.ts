import { ITagInfo } from "./types";

const isCustomElement = (node: Node): boolean => {
  return (node instanceof Element && (node.tagName.includes("-") || node.getAttribute("is")?.includes("-"))) ?? false;
}

function getCustomTagInfo(e: Element): ITagInfo {
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

const observedCustomElements: WeakSet<Element> = new Set();

function observeShadowRoot(element: Element) {
  observedCustomElements.add(element);
}

function checkObserveShadowRoot(element: Element) {
  if (element.shadowRoot) {
    if (!observedCustomElements.has(element)) {
      observeShadowRoot(element);
    }
  }
}

//
async function aaa(root: Node) {
  const elements: Element[] = [];

  // Create TreeWalker (target element and comment nodes)
  const walker = document.createTreeWalker(
    root, 
    NodeFilter.SHOW_ELEMENT,
    (node: Node): number => {
      return isCustomElement(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    } 
  );
  
  // Move to next node with TreeWalker and add matching nodes to array
  while (walker.nextNode()) {
    elements.push(walker.currentNode as Element);
  }

  const tagInfos: ITagInfo[] = [];
  const tagNames = new Set<string>();
  for(const element of elements) {
    const tagInfo = getCustomTagInfo(element);
    const customClass = customElements.get(tagInfo.name);
    if (customClass === undefined) {
      // undefined
      customElements.whenDefined(tagInfo.name).then(() => {
        // upgraded
        checkObserveShadowRoot(element);
      });
      if (!tagNames.has(tagInfo.name)) {
        tagNames.add(tagInfo.name);
        tagInfos.push(tagInfo);
      }
    } else {
      // upgraded
      checkObserveShadowRoot(element);
    }
  }
  for(const tagInfo of tagInfos) {
    //loadingTags.add(tagInfo.name);
  }

}
