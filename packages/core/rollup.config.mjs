import { defineConfig } from "rollup";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";

const input = "src/exports.ts";

export default defineConfig({
  input,
  output: [
    {
      file: "dist/index.esm.js",
      format: "esm",
      sourcemap: true
    },
    {
      file: "dist/index.esm.min.js",
      format: "esm",
      sourcemap: true,
      plugins: [terser()]
    }
  ],
  plugins: [
    typescript({
      tsconfig: "./tsconfig.json"
    })
  ]
});
