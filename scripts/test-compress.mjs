// compressMessages 로직 복제 → 29,775자 세션이 3500자 안에 들어오는지 확인
function cleanContent(content) {
  return content
    .replace(/```(mermaid|svg|plot|chart|tts|ipa|hanja)[\s\S]*?```/g, "[시각화]")
    .replace(/```[\s\S]*?```/g, "[코드]")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "[이미지]")
    .replace(/_\([^)]*\)_/g, "")
    .replace(/_?📹[^_\n]+_?/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compressMessages(messages, maxChars) {
  const relevant = messages.filter(
    (m) =>
      (m.role === "user" || m.role === "assistant") &&
      m.content.trim().length > 0 &&
      !/세션\s.+가 시작되었습니다/.test(m.content),
  );
  const picked = [];
  let total = 0;
  for (let i = relevant.length - 1; i >= 0; i--) {
    const m = relevant[i];
    const role = m.role === "user" ? "학습자" : "튜터";
    const cap = m.role === "user" ? 400 : 800;
    const body = cleanContent(m.content).slice(0, cap);
    const chunk = `[${role}] ${body}`;
    if (total + chunk.length > maxChars) {
      if (i > 0) picked.unshift(`[… 앞서 ${i}개 메시지 생략 …]`);
      break;
    }
    picked.unshift(chunk);
    total += chunk.length + 2;
  }
  return picked.join("\n\n");
}

// 29,775자 세션 재구성
const topics = ['미분계수의 기하학적 의미', '적분 기본정리', '테일러 급수', '라그랑주 승수법'];
const longText = (seed) => '이것은 테스트 메시지입니다. '.repeat(60) + seed;
const msgs = [];
for (let i = 0; i < 20; i++) {
  msgs.push({ role: 'user', content: `${topics[i%4]} 질문 ${i}: ${longText('u'+i).slice(0,500)}` });
  msgs.push({ role: 'assistant', content: `답변 ${i}: ${longText('a'+i).slice(0,1200)}` });
}

const total = msgs.reduce((s,m) => s + m.content.length, 0);
console.log('입력 총 글자수:', total);
console.log('입력 메시지 수:', msgs.length);
console.log();
const compressed = compressMessages(msgs, 3500);
console.log('압축 결과 글자수:', compressed.length);
console.log('예상 토큰 수 (한글 1.5배):', Math.round(compressed.length * 1.5));
console.log();
console.log('--- 압축된 컨텍스트 (앞 400자) ---');
console.log(compressed.slice(0, 400));
console.log();
console.log('--- 압축된 컨텍스트 (끝 400자) ---');
console.log(compressed.slice(-400));
