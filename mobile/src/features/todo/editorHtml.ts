/**
 * 본문 WYSIWYG 에디터 HTML — 웹앱과 동일한 TipTap v3 + tiptap-markdown을 WebView에 임베드.
 * 저장 포맷은 마크다운 문자열(웹과 완전 호환). RN과는 postMessage로 통신:
 *   RN → WebView: {type:'init', markdown}
 *   WebView → RN: {type:'ready'} | {type:'change', markdown}
 * (esm.sh CDN 사용 — 오프라인이면 로드 실패 → RN 쪽에서 플레인 편집으로 폴백)
 */
export function buildEditorHtml(theme: {
  bg: string;
  text: string;
  secondary: string;
  primary: string;
  divider: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; padding: 0; height: 100%; background: ${theme.bg}; }
  #toolbar {
    position: sticky; top: 0; z-index: 10; display: flex; gap: 6px; padding: 8px 12px;
    background: ${theme.bg}; border-bottom: 0.5px solid ${theme.divider}; overflow-x: auto;
  }
  #toolbar button {
    border: none; border-radius: 8px; padding: 7px 12px; font-size: 14px; font-weight: 700;
    background: transparent; color: ${theme.secondary}; font-family: -apple-system;
    white-space: nowrap;
  }
  #toolbar button.on { background: ${theme.primary}1f; color: ${theme.primary}; }
  #editor { padding: 12px 16px 40vh; outline: none; }
  .ProseMirror { outline: none; color: ${theme.text}; font-size: 16px; line-height: 1.6; font-family: -apple-system; }
  .ProseMirror p { margin: 0 0 6px; }
  .ProseMirror h1 { font-size: 24px; margin: 12px 0 6px; }
  .ProseMirror h2 { font-size: 20px; margin: 10px 0 5px; }
  .ProseMirror h3 { font-size: 17px; margin: 8px 0 4px; }
  .ProseMirror ul, .ProseMirror ol { padding-left: 22px; margin: 4px 0; }
  .ProseMirror blockquote { border-left: 3px solid ${theme.divider}; margin: 6px 0; padding-left: 10px; color: ${theme.secondary}; }
  .ProseMirror code { background: ${theme.divider}; border-radius: 4px; padding: 1px 5px; font-size: 14px; }
  .ProseMirror pre { background: ${theme.divider}; border-radius: 8px; padding: 10px; overflow-x: auto; }
  .ProseMirror p.is-editor-empty:first-child::before {
    content: attr(data-placeholder); color: ${theme.secondary}; opacity: .6; float: left; height: 0; pointer-events: none;
  }
</style>
</head>
<body>
<div id="toolbar">
  <button data-cmd="bold"><b>B</b></button>
  <button data-cmd="italic"><i>I</i></button>
  <button data-cmd="strike"><s>S</s></button>
  <button data-cmd="h2">제목</button>
  <button data-cmd="h3">소제목</button>
  <button data-cmd="bullet">• 목록</button>
  <button data-cmd="ordered">1. 목록</button>
  <button data-cmd="quote">❝ 인용</button>
  <button data-cmd="code">{ } 코드</button>
</div>
<div id="editor"></div>
<script type="module">
  const post = (m) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m));
  try {
    // 웹앱(package.json)과 동일 버전 고정 — 마크다운 직렬화 결과가 웹과 일치해야 한다
    const [{ Editor }, { default: StarterKit }, { default: Placeholder }, { Markdown }] = await Promise.all([
      import('https://esm.sh/@tiptap/core@3.27.1'),
      import('https://esm.sh/@tiptap/starter-kit@3.27.1'),
      import('https://esm.sh/@tiptap/extension-placeholder@3.27.1'),
      import('https://esm.sh/tiptap-markdown@0.9.0?deps=@tiptap/core@3.27.1'),
    ]);

    let editor;
    const emit = () => {
      try { post({ type: 'change', markdown: editor.storage.markdown.getMarkdown() }); } catch (e) {}
    };
    editor = new Editor({
      element: document.getElementById('editor'),
      extensions: [
        // 웹 RichTextEditor.jsx와 동일 설정 — 직렬화 결과가 웹과 일치해야 한다
        StarterKit.configure({
          heading: { levels: [2, 3] },
          link: { openOnClick: false, autolink: true },
        }),
        Placeholder.configure({ placeholder: '내용 추가' }),
        Markdown.configure({ html: false, transformPastedText: true, linkify: true }),
      ],
      autofocus: 'end',
      onUpdate: emit,
      onSelectionUpdate: () => refreshToolbar(),
    });

    // RN → init(markdown)
    window.__setMarkdown = (md) => {
      editor.commands.setContent(md || '');
      refreshToolbar();
    };
    document.addEventListener('message', onMsg); // android
    window.addEventListener('message', onMsg);   // ios
    function onMsg(e) {
      try {
        const m = JSON.parse(e.data);
        if (m.type === 'init') window.__setMarkdown(m.markdown);
      } catch (err) {}
    }

    const CMDS = {
      bold:    { run: () => editor.chain().focus().toggleBold().run(),                 on: () => editor.isActive('bold') },
      italic:  { run: () => editor.chain().focus().toggleItalic().run(),               on: () => editor.isActive('italic') },
      strike:  { run: () => editor.chain().focus().toggleStrike().run(),               on: () => editor.isActive('strike') },
      h2:      { run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),  on: () => editor.isActive('heading', { level: 2 }) },
      h3:      { run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),  on: () => editor.isActive('heading', { level: 3 }) },
      bullet:  { run: () => editor.chain().focus().toggleBulletList().run(),           on: () => editor.isActive('bulletList') },
      ordered: { run: () => editor.chain().focus().toggleOrderedList().run(),          on: () => editor.isActive('orderedList') },
      quote:   { run: () => editor.chain().focus().toggleBlockquote().run(),           on: () => editor.isActive('blockquote') },
      code:    { run: () => editor.chain().focus().toggleCodeBlock().run(),            on: () => editor.isActive('codeBlock') },
    };
    function refreshToolbar() {
      document.querySelectorAll('#toolbar button').forEach((b) => {
        const c = CMDS[b.dataset.cmd];
        b.classList.toggle('on', !!(c && c.on()));
      });
    }
    document.querySelectorAll('#toolbar button').forEach((b) => {
      // mousedown 시 preventDefault — 버튼 탭으로 에디터 포커스/키보드가 닫히지 않게
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => { CMDS[b.dataset.cmd].run(); refreshToolbar(); emit(); });
    });

    post({ type: 'ready' });
  } catch (e) {
    post({ type: 'error', message: String(e) });
  }
</script>
</body>
</html>`;
}
