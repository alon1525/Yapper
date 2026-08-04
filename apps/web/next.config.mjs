/** @type {import('next').NextConfig} */
const nextConfig = {
  // @wrapped/core is consumed straight from TypeScript source rather than a
  // build artifact, so the same files can be imported by a future Expo app
  // without a compile step in between.
  transpilePackages: ['@wrapped/core'],

  // @resvg/resvg-js ships a native .node addon. Webpack tries to parse it as
  // JavaScript and fails; it has to be required at runtime instead.
  serverExternalPackages: ['@resvg/resvg-js'],

  // The share-card route reads fonts and emoji from `assets/` with
  // readFileSync. That directory is outside `public/` and outside the module
  // graph, so Next's output tracing cannot infer it and the files would be
  // missing from a deployed build — the route works in `next dev` and 500s in
  // production. Naming them here is what puts them in the bundle.
  outputFileTracingIncludes: {
    '/api/share-card': ['./assets/fonts/**', './assets/emoji/**'],
  },
};

export default nextConfig;
