/** @type {import('next').NextConfig} */
const { execSync } = require('child_process');

let buildNumber = '0';
try {
    buildNumber = execSync('git rev-list --count HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
} catch {}

const isProd = process.env.NODE_ENV === 'production';

// 'unsafe-inline' em script-src é necessário enquanto não houver middleware
// injetando nonce; em style-src é exigido pelo próprio Next.
const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
    // HTTPS ativo desde 2026-07-09 (Let's Encrypt via Traefik/Coolify).
    // Sem `preload`: a lista de preload é praticamente irreversível e o domínio
    // ainda é provisório (*.sslip.io).
    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

const nextConfig = {
    transpilePackages: ['lucide-react'],
    env: {
        NEXT_PUBLIC_APP_VERSION: `1.0.${buildNumber}`,
    },
    async headers() {
        return [{ source: '/:path*', headers: securityHeaders }];
    },
}

module.exports = nextConfig
