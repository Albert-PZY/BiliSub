/** @type {import('next').NextConfig} */
const isGitHubPages = process.env.GITHUB_PAGES === 'true'

const nextConfig = {
  output: 'export',
  basePath: isGitHubPages ? '/BiliSub' : undefined,
  assetPrefix: isGitHubPages ? '/BiliSub/' : undefined,
}

export default nextConfig
