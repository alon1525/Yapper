/*
  Content Security Policy.

  This app loads nothing from anywhere else — fonts are self-hosted by
  next/font at build time, emoji and the share card's typefaces are read off
  disk on the server, the story's sound is synthesised in an AudioContext
  rather than fetched, and the only image is `/reg.png` plus the reader's own
  photos as `blob:` URLs. So every directive can name `'self'` and mean it, and
  `connect-src 'self'` is the one that matters most here: it is the browser
  refusing to send a chat anywhere but this origin, which is the product's
  central promise expressed as a header rather than as copy.

  `script-src` carries `'unsafe-inline'`, and that is a real weakening worth
  naming rather than burying. Next's hydration bootstrap and its flight data
  are inline scripts; the strict alternative is a per-request nonce, which
  needs middleware on every route and gives up static rendering. The trade is
  defensible *because* there is no HTML sink anywhere in this codebase — no
  dangerouslySetInnerHTML, no innerHTML, no eval — so there is no way to get a
  script tag onto the page for the policy to have to catch. If that ever stops
  being true, the nonce is the upgrade.

  Dev needs `'unsafe-eval'` for hot reload. Production does not, and does not
  get it.
*/
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // `blob:` is the reader's photos, which never leave the tab.
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // The analyzer runs in a Worker that Next bundles as a blob URL.
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Nobody frames this. A deck driven from inside someone else's page is a
  // clickjacking surface for the one button that spends money.
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // frame-ancestors already covers this for modern browsers; kept for the ones
  // that only understand the old header.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Chat exports are private. No URL from this app should travel to anywhere
  // else, and there is no analytics or ad tooling here that would want it.
  { key: 'Referrer-Policy', value: 'no-referrer' },
  // The app asks for none of these, so it should be unable to.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next advertises its version in this header on every response. It is free
  // reconnaissance for anyone scanning for a framework with a known CVE.
  poweredByHeader: false,

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },

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
