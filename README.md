# wc-autoloader

`wc-autoloader` is a lightweight, zero-configuration autoloader for Web Components. It leverages standard [Import Maps](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap) to automatically load component definitions when they are used in the DOM.

## Features

- **Zero Configuration**: Uses standard Import Maps to define component locations.
- **Lazy Loading**: Components are loaded only when they appear in the DOM.
- **Eager Loading**: Support for pre-loading specific components.
- **Dynamic Loading**: Observes DOM changes (MutationObserver) to load components added dynamically.
- **Loader Support**: Extensible loader system (Vanilla JS, Lit, etc.).

## Installation

```bash
npm install wc-autoloader
```

## Usage

### 1. Setup Import Map

Define your component paths in an import map using the `@components/` prefix.

```html
<script type="importmap">
  {
    "imports": {
      "@components/ui/": "./components/ui/",
      "@components/app/": "./components/app/"
    }
  }
</script>
```

### 2. Register the Handler

Import and call `registerHandler` in your main script.

```html
<script type="module">
  import { registerHandler } from "wc-autoloader";
  registerHandler();
</script>
```

### 3. Use Components

Just use your custom elements in HTML. `wc-autoloader` will automatically import the matching file.

```html
<!-- Loads ./components/ui/button.webc.js -->
<ui-button></ui-button>

<!-- Loads ./components/app/header.webc.js -->
<app-header></app-header>
```

## Import Map Syntax

`wc-autoloader` parses keys in the import map starting with `@components/`.

### Lazy Loading (Namespaces)

To enable lazy loading for a group of components, use a key ending with `/`.

Format: `"@components/<prefix>[|<loader>]/": "<path>"`

- **Prefix**: The tag prefix. Slashes are converted to dashes.
- **Loader** (Optional): The loader to use (e.g., `webc`, `lit`). Defaults to `webc`.

**Examples:**

```json
{
  "imports": {
    // Maps <my-component> to ./components/component.webc.js
    "@components/my/": "./components/",

    // Maps <ui-button> to ./ui/button.js (using 'lit' loader if configured)
    "@components/ui|lit/": "./ui/"
  }
}
```

### Eager Loading

To load a specific component immediately, use a key that does NOT end with `/`.

Format: `"@components/<tagName>[|<loader>[,<extends>]]": "<path>"`

**Examples:**

```json
{
  "imports": {
    // Eager loads <my-button> from ./my-button.js
    "@components/my-button": "./my-button.js",

    // Eager loads <fancy-input> extending 'input'
    "@components/fancy-input|vanilla,input": "./fancy-input.js"
  }
}
```

## Component Requirements

By default (using the `webc` loader), your component files should:

1.  Have a `.webc.js` extension (configurable).
2.  Export the custom element class as `default`.

```javascript
// components/ui/button.webc.js
export default class UiButton extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = '<button><slot></slot></button>';
  }
}
```

## Configuration

You can configure loaders by modifying the `config` object.

```javascript
import { registerHandler, config } from "wc-autoloader";

// Example: Change default postfix
config.loaders.webc.postfix = ".js";

registerHandler();
```

## License

MIT
