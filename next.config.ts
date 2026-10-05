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
      // Collection routes: FastAPI answers 307 with an absolute backend Location when the
      // slash is missing (leaks the backend host). A redirect rule would loop with
      // /api/x/ (Next matches both forms), so rewrite straight to the slashed URL;
      // method and body are preserved by the proxy.
      {source: '/api/documents', destination: `${BACKEND_URL}/api/documents/`},
      {source: '/api/chat', destination: `${BACKEND_URL}/api/chat/`},
      // Order matters: the slash-preserving rule must come first, otherwise
      // `:path*` drops the trailing slash and FastAPI answers 307 to an absolute URL.
      {source: '/api/:path*/', destination: `${BACKEND_URL}/api/:path*/`},
      {source: '/api/:path*', destination: `${BACKEND_URL}/api/:path*`},
    ];
  },
};

export default nextConfig;
