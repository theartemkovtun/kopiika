import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
    output: "standalone",
    reactStrictMode: true,
    // The dev overlay's default corner is bottom-left, which is exactly where
    // the sidebar keeps the theme toggle and the settings gear.
    devIndicators: { position: "bottom-right" },
    images: {
        remotePatterns: [
            { protocol: "https", hostname: "lh3.googleusercontent.com" },
        ],
    },
};

export default withNextIntl(nextConfig);
