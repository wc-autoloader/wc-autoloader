import { defineConfig } from "rollup";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import copy from "rollup-plugin-copy";

const plugins = [
  typescript({
    tsconfig: "./tsconfig.json"
  })
];

export default defineConfig([
  {
    input: "src/exports.ts",
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
      ...plugins,
      copy({
        targets: [
          { src: "src/auto/auto.js", dest: "dist" },
          { src: "src/auto/auto.min.js", dest: "dist" }
        ]
      })
    ]
  }
]);
