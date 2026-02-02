/// <reference types="vite/client" />

// Vite-specific URL imports for gzipped assets
declare module '*.json.gz?url' {
  const url: string;
  export default url;
}

// Module alias for calculator-core
declare module 'calculator-core' {
  export * from '../../../calculator-core/dist/client.js';
}
