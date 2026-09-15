/** @type {import('next').NextConfig} */
const nextConfig = {
  // ssh2 ships a native .node binary (sshcrypto) that webpack can't bundle —
  // keep it (and its wrapper) as a real require() at runtime instead.
  experimental: {
    serverComponentsExternalPackages: ["ssh2", "ssh2-sftp-client"],
  },
};

export default nextConfig;
