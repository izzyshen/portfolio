import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // the Thoughts section became Blog — keep old links working
    return [{ source: "/thoughts/:path*", destination: "/blog/:path*", permanent: true }];
  },
};

export default nextConfig;
