import { addLoader } from "@autoloader/core";

async function litLoader(moduleURL) {
  const module = await import(moduleURL);
  return module.default;
}

addLoader("lit", {
  postfix: ".lit.js",
  loader: litLoader
});