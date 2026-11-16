// 사용자가 입력한 바로 그 plot 블럭이 이제 파싱되는지 확인
const input = `y = x^2         # 위치 s(t)
f(x) = 2+x      # 속도 v(t)
x: 0 to 5
title: s(t)=t²  와 v(t)=2t`;

// MermaidChart.tsx 의 splitInlineComment / parsePlotSpec 와 동일 로직을 inline 복제
function splitInlineComment(line) {
  const m = line.match(/^(.*?)\s*(?:#|\/\/)\s*(.+?)\s*$/);
  if (m && m[1].trim().length > 0) {
    return { body: m[1].trim(), comment: m[2].trim() };
  }
  return { body: line.trim() };
}

function parsePlotSpec(raw) {
  const rawLines = raw.split(/\r?\n/).map((l) => l.trim());
  const functions = [];
  let xMin = -10, xMax = 10;
  let yMin, yMax, title;
  for (const rawLine of rawLines) {
    if (!rawLine || /^(#|\/\/)/.test(rawLine)) continue;
    const { body: line, comment: userLabel } = splitInlineComment(rawLine);
    if (!line) continue;
    const xRange =
      line.match(/^x\s*:\s*(-?\d*\.?\d+)\s*(?:to|\.\.|-)\s*(-?\d*\.?\d+)/i) ||
      line.match(/^x\s*(?:in|=)\s*\[\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\]/i);
    if (xRange) { xMin = parseFloat(xRange[1]); xMax = parseFloat(xRange[2]); continue; }
    const yRange =
      line.match(/^y\s*:\s*(-?\d*\.?\d+)\s*(?:to|\.\.|-)\s*(-?\d*\.?\d+)/i) ||
      line.match(/^y\s*(?:in|=)\s*\[\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\]/i);
    if (yRange) { yMin = parseFloat(yRange[1]); yMax = parseFloat(yRange[2]); continue; }
    const titleMatch = line.match(/^title\s*:\s*(.+)$/i);
    if (titleMatch) { title = titleMatch[1].trim(); continue; }
    const fnMatch = line.match(/^(?:([a-zA-Z]\w*)\s*\(\s*x\s*\)|y)\s*=\s*(.+)$/);
    if (fnMatch) {
      const fnName = fnMatch[1] ? `${fnMatch[1]}(x)` : "y";
      const label = userLabel ? `${userLabel}  (${fnName})` : fnName;
      functions.push({ expr: fnMatch[2].trim(), label });
      continue;
    }
    if (!/^(x|y|title|range)\s*[:=]/i.test(line)) {
      const fnName = `f${functions.length + 1}(x)`;
      const label = userLabel ? `${userLabel}  (${fnName})` : fnName;
      functions.push({ expr: line, label });
    }
  }
  return { functions, xMin, xMax, yMin, yMax, title };
}

const spec = parsePlotSpec(input);
console.log(JSON.stringify(spec, null, 2));
