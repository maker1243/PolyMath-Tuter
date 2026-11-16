/**
 * SSR 중에 바로 라이트/다크 테마 class 를 적용해 FOUC(깜빡임) 방지.
 * layout.tsx 의 <head> 에 삽입. localStorage("polymath:theme") 값 또는 OS prefers.
 */
export function ThemeScript() {
  const code = `
    (function(){
      try {
        var saved = localStorage.getItem('polymath:theme');
        var mode = saved || 'dark';
        if (mode === 'system') {
          mode = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        }
        var root = document.documentElement;
        root.classList.remove('dark','light');
        root.classList.add(mode);
      } catch (e) {}
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
