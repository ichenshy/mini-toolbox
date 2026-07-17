const COLORS = {
  keyword: '#FF7AB2',
  string: '#FF8170',
  number: '#FFD60A',
  comment: '#6A9955',
  function: '#79C0FF',
  type: '#ACF2E8',
  property: '#9CDCFE',
  flag: '#D9C97C',
  tag: '#7EE787',
  attribute: '#79C0FF',
  default: '#F5F5F7'
};

const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'AS', 'ON', 'JOIN',
  'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'UNION', 'ALL',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE',
  'ALTER', 'DROP', 'INDEX', 'VIEW', 'DATABASE', 'IF', 'EXISTS', 'NULL',
  'IS', 'LIKE', 'BETWEEN', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT',
  'OFFSET', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CASE',
  'WHEN', 'THEN', 'ELSE', 'END', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES',
  'CONSTRAINT', 'DEFAULT', 'AUTO_INCREMENT', 'DESC', 'ASC'
]);

const JS_KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally',
  'throw', 'new', 'class', 'extends', 'import', 'export', 'from', 'default',
  'async', 'await', 'typeof', 'instanceof', 'in', 'of', 'this', 'super',
  'true', 'false', 'null', 'undefined', 'void', 'delete', 'yield', 'static',
  'get', 'set', 'interface', 'type', 'enum', 'implements', 'public', 'private',
  'protected', 'readonly', 'declare', 'namespace', 'module', 'as', 'is'
]);

const PY_KEYWORDS = new Set([
  'def', 'class', 'if', 'elif', 'else', 'for', 'while', 'try', 'except',
  'finally', 'with', 'as', 'import', 'from', 'return', 'yield', 'raise',
  'pass', 'break', 'continue', 'lambda', 'and', 'or', 'not', 'in', 'is',
  'True', 'False', 'None', 'global', 'nonlocal', 'assert', 'del', 'async', 'await'
]);

const JAVA_KEYWORDS = new Set([
  'public', 'private', 'protected', 'class', 'interface', 'extends', 'implements',
  'static', 'final', 'void', 'int', 'long', 'double', 'float', 'boolean', 'char',
  'byte', 'short', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break',
  'continue', 'return', 'new', 'this', 'super', 'try', 'catch', 'finally', 'throw',
  'throws', 'import', 'package', 'true', 'false', 'null', 'enum', 'default'
]);

const BASH_KEYWORDS = new Set([
  'if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case',
  'esac', 'in', 'function', 'return', 'exit', 'export', 'local', 'source',
  'echo', 'cd', 'pwd', 'ls', 'cat', 'grep', 'chmod', 'sudo'
]);

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function span(type, text) {
  return `<span style="color:${COLORS[type] || COLORS.default}">${text}</span>`;
}

function normalizeLanguage(language) {
  const lang = String(language || '').trim().toLowerCase();
  const map = {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    sh: 'bash',
    shell: 'bash',
    zsh: 'bash',
    yml: 'yaml',
    md: 'markdown'
  };
  return map[lang] || lang || 'plain';
}

function isStyled(text) {
  return String(text).includes('style="color:');
}

/**
 * 在尚未高亮的文本片段上应用替换，跳过已有 HTML 标签，避免二次污染。
 */
function mapPlainSegments(source, mapper) {
  return String(source).replace(/(<[^>]+>)|([^<]+)/g, (full, tag, text) => {
    if (tag) {
      return tag;
    }
    return mapper(text || '');
  });
}

function applyPattern(source, regex, replacer) {
  return mapPlainSegments(source, (segment) => {
    return segment.replace(regex, (...args) => {
      const offset = args[args.length - 2];
      if (typeof offset !== 'number') {
        return args[0];
      }
      return replacer(...args);
    });
  });
}

function highlightCommentsAndStrings(source) {
  let result = source;

  result = applyPattern(result, /(\/\*[\s\S]*?\*\/|--[^\n]*|#(?!!)[^\n]*)/g, (match) => {
    if (isStyled(match)) {
      return match;
    }
    return span('comment', match);
  });

  result = applyPattern(result, /(&quot;(?:\\.|[^&])*?&quot;|'(?:\\.|[^'])*?'|`(?:\\.|[^`])*?`)/g, (match) => {
    if (isStyled(match)) {
      return match;
    }
    return span('string', match);
  });

  return result;
}

function highlightNumbers(source) {
  return applyPattern(source, /\b(\d+(?:\.\d+)?)\b/g, (match) => {
    if (isStyled(match)) {
      return match;
    }
    return span('number', match);
  });
}

function highlightKeywords(source, keywords) {
  const pattern = new RegExp(`\\b(${Array.from(keywords).join('|')})\\b`, 'gi');
  return applyPattern(source, pattern, (match) => {
    if (isStyled(match)) {
      return match;
    }
    return span('keyword', match);
  });
}

function highlightFunctions(source) {
  return applyPattern(source, /\b([A-Za-z_][\w]*)(?=\s*\()/g, (match, name) => {
    if (isStyled(match)) {
      return match;
    }
    return span('function', name);
  });
}

function highlightSql(source) {
  let result = highlightCommentsAndStrings(source);
  result = highlightKeywords(result, SQL_KEYWORDS);
  result = highlightNumbers(result);
  return result;
}

function highlightJavaScript(source) {
  let result = highlightCommentsAndStrings(source);
  result = highlightKeywords(result, JS_KEYWORDS);
  result = highlightFunctions(result);
  result = highlightNumbers(result);
  return result;
}

function highlightPython(source) {
  let result = highlightCommentsAndStrings(source);
  result = applyPattern(result, /(@\w+)/g, (match) => span('type', match));
  result = highlightKeywords(result, PY_KEYWORDS);
  result = highlightFunctions(result);
  result = highlightNumbers(result);
  return result;
}

function highlightJson(source) {
  let result = source;
  result = applyPattern(result, /(&quot;(?:\\.|[^&])*?&quot;)(\s*:)/g, (match, key, colon) => {
    return `${span('property', key)}${colon}`;
  });
  result = applyPattern(result, /:\s*(&quot;(?:\\.|[^&])*?&quot;)/g, (match, str) => {
    return `: ${span('string', str)}`;
  });
  result = applyPattern(result, /:\s*\b(true|false|null)\b/g, (match, value) => {
    return `: ${span('keyword', value)}`;
  });
  result = highlightNumbers(result);
  return result;
}

function highlightBash(source) {
  let result = highlightCommentsAndStrings(source);
  result = applyPattern(result, /(^|\s)(-[a-zA-Z]+)/g, (match, prefix, flag) => {
    return `${prefix}${span('flag', flag)}`;
  });
  result = highlightKeywords(result, BASH_KEYWORDS);
  return result;
}

function highlightJava(source) {
  let result = highlightCommentsAndStrings(source);
  result = highlightKeywords(result, JAVA_KEYWORDS);
  result = applyPattern(result, /\b([A-Z][\w]*)\b/g, (match) => {
    if (isStyled(match)) {
      return match;
    }
    return span('type', match);
  });
  result = highlightFunctions(result);
  result = highlightNumbers(result);
  return result;
}

function highlightCss(source) {
  let result = highlightCommentsAndStrings(source);
  result = applyPattern(result, /([.#][\w-]+)/g, (match) => span('tag', match));
  result = applyPattern(result, /([\w-]+)(\s*:)/g, (match, prop, colon) => {
    if (isStyled(match)) {
      return match;
    }
    return `${span('property', prop)}${colon}`;
  });
  result = applyPattern(result, /(:\s*)([^;{}]+)/g, (match, prefix, value) => {
    if (isStyled(match)) {
      return match;
    }
    return `${prefix}${span('string', value.trim())}`;
  });
  return result;
}

function highlightMarkup(source) {
  let result = source;
  result = applyPattern(result, /(&lt;\/?)([\w-]+)/g, (match, open, tag) => {
    if (isStyled(match)) {
      return match;
    }
    return `${open}${span('tag', tag)}`;
  });
  result = applyPattern(result, /([\w-]+)(=)/g, (match, attr, eq) => {
    if (isStyled(match)) {
      return match;
    }
    return `${span('attribute', attr)}${eq}`;
  });
  result = applyPattern(result, /(=)(&quot;(?:\\.|[^&])*?&quot;)/g, (match, eq, str) => {
    return `${eq}${span('string', str)}`;
  });
  return result;
}

function highlightGeneric(source) {
  let result = highlightCommentsAndStrings(source);
  result = highlightNumbers(result);
  return result;
}

const HIGHLIGHTERS = {
  sql: highlightSql,
  javascript: highlightJavaScript,
  typescript: highlightJavaScript,
  python: highlightPython,
  json: highlightJson,
  bash: highlightBash,
  java: highlightJava,
  css: highlightCss,
  html: highlightMarkup,
  xml: highlightMarkup,
  plain: highlightGeneric
};

/**
 * 返回带语法高亮的代码块 HTML（深色主题）。
 */
function highlightCode(code, language) {
  const lang = normalizeLanguage(language);
  const escaped = escapeHtml(String(code || ''));
  const highlighter = HIGHLIGHTERS[lang] || highlightGeneric;
  const body = highlighter(escaped);

  return (
    `<pre style="background:#1f1a14;color:#f7f1e8;padding:14px 16px;border-radius:12px;` +
    `overflow:auto;font-size:12px;line-height:1.55;margin:0 0 14px;` +
    `white-space:pre-wrap;word-break:break-word;` +
    `font-family:SF Mono,Menlo,ui-monospace,monospace;` +
    `border:1px solid rgba(255,245,230,0.08);">` +
    `<code style="color:#f7f1e8;background:transparent;padding:0;` +
    `font-size:12px;line-height:1.55;font-family:inherit;">${body}</code></pre>`
  );
}

module.exports = {
  highlightCode,
  normalizeLanguage
};
