/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Permite export estático (carpeta 'out')
  output: 'export',
  images: {
    // Requerido para next/image en export estático
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  }
};

export default nextConfig;
