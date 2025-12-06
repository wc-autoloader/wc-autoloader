# webc-autoloader
web component auto loader with importmap

# 仕様

importmap key:
"@components/app/": "/path/to/components/",

prefix map "app" => "@components/app/"
postfix(default) "*" => ".js"
loader(default) "*" => webc

<app-main></app-main>

create path "@components/app/main.js"
getComponentClass("@components/app/main.js") // loader
customeElements.define("app-main", componentClass)

```html
<script type="importmap">
  {
    "imports": {
      "@lit/core": "/path/to/lit-core.js",
      "@components/app/": "/path/to/components/",
      "@components/app|lit/": "/path/to/components/lit/",
      "@components/app-sub1": "/path/to/components/sumComponent1.js", // app-sub1
      "@components/app/sub2|lit": "/path/to/components/sumComponent2.js", // app-sub2
      "@components/app/sub3|lit,div": "/path/to/components/sumComponent3.js", // app-sub3
      "@components/app/sub4|*,div": "/path/to/components/sumComponent4.js", // app-sub4
      "@autoloader/core": "/path/to/autoloader"
    }
  }
</script>
<script type="module" src="/path/to/autoloader/boot.js"></script>

<script type="module">
import { setAutoLoaderConfig, importDefaultClass } from "@autoloader";
import { componentFromModule } from "@lit/core";

setAutoLoaderConfig({
  scanImportmap: true,
  loaders: {
    "webc": {
      postfix: ".js",
      loader: importDefaultClass
    },
    "lit": {
      postfix: ".js",
      loader: convertFromModule
    },
    "*": "webc"
  },
  observable: true,
});
</script>
```

```js:autoloader.js
export function importDefaultClass(path) {
  const module = await import(path);
  return module.default;
}
```