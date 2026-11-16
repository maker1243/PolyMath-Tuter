export interface RoomTemplate {
  id: string;
  title: string;
  subject: string;
  difficulty: string;
  language: "javascript" | "python";
  description: string;
  initialCode: string;
  emoji: string;
}

export const ROOM_TEMPLATES: RoomTemplate[] = [
  {
    id: "dp-fib-memo",
    emoji: "🧮",
    title: "DP 입문: fib 메모이제이션",
    subject: "알고리즘",
    difficulty: "입문",
    language: "javascript",
    description:
      "재귀 fib(35) 가 왜 느린지 분석하고, 메모이제이션으로 1초 미만을 만드세요. 완료 조건: fib(40) 를 100ms 안에 계산.",
    initialCode: `// 함께 디버깅: 아래 fib 를 메모이제이션으로 개선하세요.
function fib(n) {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}

const t = Date.now();
console.log(fib(35));
console.log('elapsed:', Date.now() - t, 'ms');
`,
  },
  {
    id: "two-sum",
    emoji: "🎯",
    title: "Two Sum — O(n) 풀이",
    subject: "알고리즘",
    difficulty: "입문",
    language: "javascript",
    description:
      "nums 배열과 target 이 주어졌을 때, 두 수의 합이 target 이 되는 인덱스 쌍을 찾으세요. 완료 조건: 모든 테스트 통과 + O(n).",
    initialCode: `function twoSum(nums, target) {
  // TODO: O(n) 해시맵 풀이
}

console.assert(JSON.stringify(twoSum([2,7,11,15], 9)) === '[0,1]', 'basic');
console.assert(JSON.stringify(twoSum([3,2,4], 6)) === '[1,2]', 'mid');
console.log('all tests passed');
`,
  },
  {
    id: "react-hooks-counter",
    emoji: "⚛️",
    title: "React Hooks: useReducer 전환",
    subject: "웹 프론트엔드",
    difficulty: "중급",
    language: "javascript",
    description:
      "아래 useState 로 짜인 카운터를 useReducer 로 리팩터하세요. 액션: increment / decrement / reset. 함께 코드 설명 주석을 다세요.",
    initialCode: `// 아래를 useReducer 기반으로 바꾸세요.
function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <button onClick={() => setCount(c => c - 1)}>-</button>
      <span>{count}</span>
      <button onClick={() => setCount(c => c + 1)}>+</button>
      <button onClick={() => setCount(0)}>reset</button>
    </div>
  );
}
`,
  },
  {
    id: "sql-join-practice",
    emoji: "🗄️",
    title: "SQL JOIN 복습",
    subject: "데이터베이스",
    difficulty: "중급",
    language: "javascript",
    description:
      "users 와 orders 가 주어졌을 때, '주문이 1개 이상인 사용자의 이름과 총 주문 수' 를 SQL 로 작성하세요. 코멘트로 ERD를 그리고 논의.",
    initialCode: `-- schema
-- users(id, name)
-- orders(id, user_id, amount)

-- TODO: 주문이 1개 이상인 사용자의 이름 + 총 주문 수
SELECT
  -- ...
FROM users
-- JOIN orders ...
-- GROUP BY ...
;
`,
  },
  {
    id: "py-list-comp",
    emoji: "🐍",
    title: "Python 리스트 컴프리헨션",
    subject: "함수형 프로그래밍",
    difficulty: "입문",
    language: "python",
    description:
      "주어진 for 루프를 리스트 컴프리헨션 한 줄로 바꾸고, 가독성 vs 성능을 비교해보세요.",
    initialCode: `# TODO: 아래를 리스트 컴프리헨션으로 바꾸기
nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

squares_of_evens = []
for n in nums:
    if n % 2 == 0:
        squares_of_evens.append(n * n)

print(squares_of_evens)
# 기대: [4, 16, 36, 64, 100]
`,
  },
  {
    id: "trs-attn-notes",
    emoji: "🧠",
    title: "트랜스포머 어텐션 노트",
    subject: "머신러닝/딥러닝",
    difficulty: "고급",
    language: "python",
    description:
      "Q·K·V 세 행렬로 scaled dot-product attention 을 구현하세요. 각 라인에 한 줄 주석. 함께 수식을 복기.",
    initialCode: `import numpy as np

def attention(Q, K, V):
    # TODO: softmax((Q @ K.T) / sqrt(d_k)) @ V
    pass

Q = np.random.randn(2, 4)
K = np.random.randn(3, 4)
V = np.random.randn(3, 5)
print(attention(Q, K, V))
`,
  },
];
