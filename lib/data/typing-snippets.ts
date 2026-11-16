/**
 * 코드 타이핑 드릴용 스니펫 모음.
 * - Python / JavaScript / TypeScript 3종
 * - 난이도: short (~10줄, 기본 문법) / medium (~20줄, 알고리즘)
 */

export type TypingLang = "python" | "javascript" | "typescript";
export type TypingLevel = "short" | "medium";

export interface TypingSnippet {
  id: string;
  lang: TypingLang;
  level: TypingLevel;
  title: string;
  code: string;
}

export const TYPING_SNIPPETS: TypingSnippet[] = [
  // Python — short
  {
    id: "py-fib",
    lang: "python",
    level: "short",
    title: "Fibonacci (재귀)",
    code: `def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

print(fib(10))`,
  },
  {
    id: "py-list-comp",
    lang: "python",
    level: "short",
    title: "List Comprehension",
    code: `nums = [1, 2, 3, 4, 5]
squares = [n * n for n in nums if n % 2 == 1]
print(squares)`,
  },
  {
    id: "py-class",
    lang: "python",
    level: "short",
    title: "클래스 정의",
    code: `class Dog:
    def __init__(self, name):
        self.name = name

    def bark(self):
        return f"{self.name} says woof!"

d = Dog("Rex")
print(d.bark())`,
  },
  // Python — medium
  {
    id: "py-quicksort",
    lang: "python",
    level: "medium",
    title: "Quicksort",
    code: `def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    mid = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + mid + quicksort(right)

print(quicksort([3, 6, 1, 8, 2, 9, 5]))`,
  },
  {
    id: "py-bfs",
    lang: "python",
    level: "medium",
    title: "BFS (너비 우선 탐색)",
    code: `from collections import deque

def bfs(graph, start):
    visited = {start}
    queue = deque([start])
    order = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for nb in graph[node]:
            if nb not in visited:
                visited.add(nb)
                queue.append(nb)
    return order`,
  },

  // JavaScript — short
  {
    id: "js-arrow",
    lang: "javascript",
    level: "short",
    title: "Arrow Function + map",
    code: `const nums = [1, 2, 3, 4, 5];
const doubled = nums.map((n) => n * 2);
console.log(doubled);`,
  },
  {
    id: "js-destructure",
    lang: "javascript",
    level: "short",
    title: "Destructuring",
    code: `const user = { name: "Ada", age: 28, city: "Seoul" };
const { name, age } = user;
console.log(\`\${name} is \${age} years old\`);`,
  },
  {
    id: "js-promise",
    lang: "javascript",
    level: "short",
    title: "Promise 체인",
    code: `fetch("/api/users")
  .then((res) => res.json())
  .then((data) => console.log(data))
  .catch((err) => console.error(err));`,
  },
  // JavaScript — medium
  {
    id: "js-debounce",
    lang: "javascript",
    level: "medium",
    title: "Debounce 함수",
    code: `function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

const log = debounce(() => console.log("hi"), 300);`,
  },
  {
    id: "js-memoize",
    lang: "javascript",
    level: "medium",
    title: "Memoize",
    code: `function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}`,
  },

  // TypeScript — short
  {
    id: "ts-generic",
    lang: "typescript",
    level: "short",
    title: "Generic 함수",
    code: `function head<T>(arr: T[]): T | undefined {
  return arr.length > 0 ? arr[0] : undefined;
}

const n = head<number>([1, 2, 3]);
const s = head<string>(["a", "b"]);`,
  },
  {
    id: "ts-interface",
    lang: "typescript",
    level: "short",
    title: "Interface + 함수 타입",
    code: `interface User {
  id: string;
  name: string;
  active: boolean;
}

function greet(u: User): string {
  return \`Hello, \${u.name}\`;
}`,
  },
  // TypeScript — medium
  {
    id: "ts-reducer",
    lang: "typescript",
    level: "medium",
    title: "Reducer 패턴",
    code: `type Action =
  | { type: "add"; value: number }
  | { type: "reset" };

function reducer(state: number, action: Action): number {
  switch (action.type) {
    case "add":
      return state + action.value;
    case "reset":
      return 0;
  }
}`,
  },
  {
    id: "ts-utility",
    lang: "typescript",
    level: "medium",
    title: "Utility Types",
    code: `interface Todo {
  id: number;
  title: string;
  done: boolean;
}

type PartialTodo = Partial<Todo>;
type TodoKeys = keyof Todo;
type ReadonlyTodo = Readonly<Todo>;

const t: PartialTodo = { title: "study" };`,
  },
];

export function snippetsFor(lang: TypingLang | "all", level: TypingLevel | "all"): TypingSnippet[] {
  return TYPING_SNIPPETS.filter(
    (s) => (lang === "all" || s.lang === lang) && (level === "all" || s.level === level),
  );
}
