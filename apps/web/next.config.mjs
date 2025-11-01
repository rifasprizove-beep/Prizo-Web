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
    // Ajusta dominios si usas next/image remoto; dejamos defaults
  },
};

export default nextConfig;
