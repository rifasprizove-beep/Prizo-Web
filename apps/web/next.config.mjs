/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  },
  // Ejecutaremos Next.js como servicio web (no export estático)
  images: {
    // Permitir imágenes remotas (ej. vehicle-images.dealersinspire.com y otras)
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default nextConfig;
