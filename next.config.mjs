/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      // ssh2 ships a native .node binary (sshcrypto) that webpack can't
      // bundle — keep it (and its wrapper) as a real require() at runtime.
      "ssh2",
      "ssh2-sftp-client",
      // piscina spawns its own worker threads internally via new Worker().
      // Webpack's static worker-detection heuristic intercepts that call
      // when piscina gets bundled, and tries to emit a separate worker
      // chunk next to the route's own compiled output — which doesn't
      // exist, since piscina resolves its worker script dynamically at
      // runtime, not via a statically analyzable `new URL(...)`. That
      // produces "Cannot find module '.../run/worker.js'" at runtime and
      // crashes every single parse attempt. Excluding it from bundling
      // leaves it as a plain require() so it runs exactly as it does
      // outside of Next.js.
      "piscina",
    ],
  },
};

export default nextConfig;
