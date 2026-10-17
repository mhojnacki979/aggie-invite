/** @type {import('next').NextConfig} */

// Served from the custom domain aggieinvite.eyesonscore.com at root, so the
// default basePath is ''. To build for a GitHub Pages project path instead
// (mhojnacki979.github.io/aggie-invite/), set BASE_PATH=/aggie-invite.
const basePath = process.env.BASE_PATH ?? ''

const nextConfig = {
  // Static HTML export — no Node server needed. Output lands in ./out
  output: 'export',
  // Folder-style URLs (/past/2025/index.html) for clean static hosting.
  trailingSlash: true,
  // The export has no image optimizer; serve images as-is.
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath || undefined,
  // Exposed to components so static <img> srcs can be basePath-prefixed
  // (next/image does not do this under output:'export' + unoptimized).
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
}

export default nextConfig
