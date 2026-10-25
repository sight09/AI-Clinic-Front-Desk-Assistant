import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/admin", destination: "/staff", permanent: false },
      { source: "/doctor", destination: "/staff", permanent: false },
      { source: "/clinician", destination: "/staff", permanent: false },
      { source: "/reception", destination: "/staff", permanent: false },
      { source: "/receptionist", destination: "/staff", permanent: false },
    ];
  },
};

export default nextConfig;
