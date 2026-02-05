import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://js.tosspayments.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",

              // ✅ 토스 결제위젯/SDK가 호출하는 통신 도메인 허용
              [
                "connect-src 'self'",
                "https://api.tosspayments.com",
                "https://event.tosspayments.com",
                "https://log.tosspayments.com",
                "https://apigw-sandbox.tosspayments.com",
              ].join(" "),

              // ✅ 결제창/리디렉션/프레임 허용
              "frame-src 'self' https://pay.toss.im https://tosspayments.com https://*.tosspayments.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;