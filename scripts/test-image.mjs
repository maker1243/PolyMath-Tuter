import { expandImageDirectives } from "../lib/image-gen.ts";
const input = "답변 중간입니다.\n\n![뉴런](image-gen:a biological neuron with dendrites)\n\n이후 설명.";
const out = await expandImageDirectives(input, { provider: "pollinations" }, { max: 1 });
console.log("--- OUT ---");
console.log(out);
console.log("--- HAS URL ---", /pollinations/.test(out));
