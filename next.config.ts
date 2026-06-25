import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@node-rs/argon2", "postgres"],
  experimental: {
    // Upload de logo/favicon via Server Action : la limite par défaut (1 Mo)
    // rejette les images un peu lourdes. La validation client plafonne à 2 Mo ;
    // 3 Mo couvre le fichier + l'overhead multipart.
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
