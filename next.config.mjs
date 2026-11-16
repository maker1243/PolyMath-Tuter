/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Docker 멀티스테이지 빌드 — standalone 서버로 최소 이미지
  output: "standalone",
  // 서버에서는 monaco·y-monaco 를 아예 실행하지 않고, yjs 는 단일 인스턴스가 유지되도록
  // externals 로 둠(그렇지 않으면 "Yjs was already imported" 경고로 constructor check 실패).
  webpack: (config, { isServer, dev }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        "monaco-editor",
        "y-monaco",
        "yjs",
      ];
    }
    if (dev) {
      // .polymath-data 쓰기가 file-watcher 를 트리거해 서버 모듈을 리셋하는 걸 막음
      config.watchOptions = {
        ...(config.watchOptions ?? {}),
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.next/**",
          "**/.polymath-data/**",
        ],
      };
    }
    return config;
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
