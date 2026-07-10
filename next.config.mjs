/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone", // self-contained server build for Docker/Render/Railway
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }] },
  experimental: {
    // Verification doc uploads (ID/diploma images or PDFs) exceed the 1MB default.
    serverActions: { bodySizeLimit: "12mb" },
  },
};
export default nextConfig;
