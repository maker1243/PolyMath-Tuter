// y2 = ... 처럼 임의 좌변 변수가 이제 받아들여지는지 확인
function splitInlineComment(line) {
  const m = line.match(/^(.*?)\s*(?:#|\/\/)\s*(.+?)\s*$/);
  if (m && m[1].trim().length > 0) return { body: m[1].trim(), comment: m[2].trim() };
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
    const fnCall = line.match(/^([a-zA-Z]\w*)\s*\(\s*x\s*\)\s*=\s*(.+)$/);
    if (fnCall) {
      const fnName = `${fnCall[1]}(x)`;
      functions.push({ expr: fnCall[2].trim(), label: userLabel ? `${userLabel}  (${fnName})` : fnName });
      continue;
    }
    const varM = line.match(/^([a-zA-Z]\w*)\s*=\s*(.+)$/);
    if (varM && varM[1].toLowerCase() !== "x") {
      const fnName = varM[1];
      functions.push({ expr: varM[2].trim(), label: userLabel ? `${userLabel}  (${fnName})` : fnName });
      continue;
    }
    if (!/^(x|title|range)\s*[:=]/i.test(line)) {
      functions.push({ expr: line, label: `f${functions.length + 1}(x)` });
    }
  }
  return { functions, xMin, xMax, yMin, yMax, title };
}

const tests = [
  "y2 = 4*x^3 - 6*x\nx: -2 to 2",
  "y1 = x^2\ny2 = 4*x^3 - 6*x\ny3 = sin(x)\nx: -3 to 3",
  "h = x^2 - 1  # 간단한 포물선\nk = 2*x\nx: -5 to 5",
  "y_prime = 2*x\ny_double_prime = 2\nx: 0 to 3",
  "sin(x)  # 그냥 수식만\nx: -pi to pi",
];
for (const t of tests) {
  console.log("--- INPUT ---");
  console.log(t);
  console.log("--- RESULT ---");
  console.log(JSON.stringify(parsePlotSpec(t), null, 2));
  console.log();
}
