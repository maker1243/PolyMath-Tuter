"use client";

/**
 * 루트 레이아웃 자체가 터질 때의 최후 바운더리.
 * html/body 를 자체 렌더해야 함 (RootLayout 을 신뢰할 수 없는 상황이므로).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  function clearAndHome() {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      /* ignore */
    }
    location.href = "/";
  }

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          background: "#0b0f1a",
          color: "#e6e8ee",
          fontFamily:
            "system-ui, -apple-system, 'Noto Sans KR', Segoe UI, sans-serif",
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <h1 style={{ marginTop: 16, fontSize: 20 }}>
            치명적인 오류가 발생했어요
          </h1>
          <p style={{ marginTop: 8, color: "#9aa3b2", fontSize: 14 }}>
            페이지 전체를 그리다가 멈췄습니다. 아래 버튼으로 복구해 보세요.
          </p>
          <pre
            style={{
              marginTop: 16,
              padding: 12,
              background: "#1a1f2e",
              border: "1px solid #2b3245",
              borderRadius: 8,
              color: "#f0a66a",
              fontSize: 11,
              textAlign: "left",
              overflow: "auto",
            }}
          >
            {error.message}
            {error.digest ? `\ndigest: ${error.digest}` : ""}
          </pre>
          <div
            style={{
              marginTop: 16,
              display: "flex",
              gap: 8,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: "8px 16px",
                background: "#1e2535",
                color: "#e6e8ee",
                border: "1px solid #2b3245",
                borderRadius: 10,
                cursor: "pointer",
              }}
            >
              다시 시도
            </button>
            <button
              type="button"
              onClick={clearAndHome}
              style={{
                padding: "8px 16px",
                background: "#f0a66a",
                color: "#1a1a1a",
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              캐시 정리 후 홈으로
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
