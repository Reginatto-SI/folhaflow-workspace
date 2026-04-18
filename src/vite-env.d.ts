/// <reference types="vite/client" />

// Constantes injetadas pelo Vite via `define` em vite.config.ts.
// __BUILD_TIME__: ISO timestamp do momento do build
// __BUILD_ID__: hash curto base36 do timestamp do build
declare const __BUILD_TIME__: string;
declare const __BUILD_ID__: string;
