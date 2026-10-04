import type {NextConfig} from 'next';

// Read at build time (rewrites are serialized into the routes manifest).
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  output: 'standalone',
  // FastAPI routes end with a slash (/api/chat/, /api/documents/): do not let
  // Next redirect /api/chat/ -> /api/chat (308), which would break POST via the proxy.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      // Order matters: the slash-preserving rule must come first, otherwise
      // `:path*` drops the trailing slash and FastAPI answers 307 to an absolute URL.
      {source: '/api/:path*/', destination: `${BACKEND_URL}/api/:path*/`},
      {source: '/api/:path*', destination: `${BACKEND_URL}/api/:path*`},
    ];
  },
};

export default nextConfig;
