const { marked } = require('./marked.min.js');
const { highlightCode } = require('./highlight.js');

marked.use({
  gfm: true,
  breaks: false,
  renderer: {
    // 代码块走语法高亮（深底浅字）
    code({ text, lang }) {
      return highlightCode(text, lang || 'plain');
    },
    // 行内代码：浅底深字
    codespan({ text }) {
      return (
        `<code style="font-family:SF Mono,Menlo,ui-monospace,monospace;font-size:13px;` +
        `background:rgba(118,118,128,0.12);padding:1px 5px;border-radius:4px;` +
        `color:#1c1c1e;">${text}</code>`
      );
    }
  }
});

/**
 * 将 Markdown 转为 HTML，供 mp-html 渲染。
 */
function markdownToHtml(markdown) {
  return marked.parse(String(markdown || ''));
}

module.exports = {
  markdownToHtml
};
