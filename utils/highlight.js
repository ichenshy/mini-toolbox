const COLORS = {
  keyword: '#FF7AB2',
  string: '#FF8170',
  number: '#FFD60A',
  comment: '#6A9955',
  function: '#79C0FF',
  type: '#ACF2E8',
  property: '#9CDCFE',
  operator: '#DFDFE0',
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

function applyPattern(source, regex, replacer) {
  return source.replace(regex, (...args) => {
    const match = args[0];
    const offset = args[args.length - 2];
    if (typeof offset !== 'number') {
      return match;
    }
    return replacer(match, offset, ...args);
  });
}

function highlightCommentsAndStrings(source) {
  let result = source;

  result = applyPattern(result, /(\/\*[\s\S]*?\*\/|--[^\n]*|#(?!!)[^\n]*)/g, (match) => span('comment', match));
  result = applyPattern(result, /(&quot;(?:\\.|[^&])*?&quot;|'(?:\\.|[^'])*?'|`(?:\\.|[^`])*?`)/g, (match) => {
    if (match.includes('style="color:')) {
      return match;
    }
    return span('string', match);
  });

  return result;
}

function highlightNumbers(source) {
  return applyPattern(source, /\b(\d+(?:\.\d+)?)\b/g, (match) => {
    if (match.includes('style="color:')) {
      return match;
    }
    return span('number', match);
  });
}

function highlightKeywords(source, keywords) {
  const pattern = new RegExp(`\\b(${Array.from(keywords).join('|')})\\b`, 'gi');
  return applyPattern(source, pattern, (match) => {
    if (match.includes('style="color:')) {
      return match;
    }
    return span('keyword', match);
  });
}

function highlightFunctions(source) {
  return applyPattern(source, /\b([A-Za-z_][\w]*)\s*(?=\()/g, (match, offset, full, name) => {
    if (match.includes('style="color:')) {
      return match;
    }
    return `${span('function', name)}(`;
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
  result = applyPattern(result, /(&quot;(?:\\.|[^&])*?&quot;)(\s*:)/g, (_, key, colon) => `${span('property', key)}${colon}`);
  result = applyPattern(result, /:\s*(&quot;(?:\\.|[^&])*?&quot;)/g, (match, str) => `: ${span('string', str)}`);
  result = applyPattern(result, /:\s*\b(true|false|null)\b/g, (match, value) => `: ${span('keyword', value)}`);
  result = highlightNumbers(result);
  return result;
}

function highlightBash(source) {
  let result = highlightCommentsAndStrings(source);
  result = applyPattern(result, /(^|\s)(-[a-zA-Z]+)/g, (_, prefix, flag) => `${prefix}${span('flag', flag)}`);
  result = highlightKeywords(result, BASH_KEYWORDS);
  return result;
}

function highlightJava(source) {
  let result = highlightCommentsAndStrings(source);
  result = highlightKeywords(result, JAVA_KEYWORDS);
  result = applyPattern(result, /\b([A-Z][\w]*)\b/g, (match) => {
    if (match.includes('style="color:')) {
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
    if (match.includes('style="color:')) {
      return match;
    }
    return `${span('property', prop)}${colon}`;
  });
  result = applyPattern(result, /(:\s*)([^;{}]+)/g, (match, prefix, value) => {
    if (match.includes('style="color:')) {
      return match;
    }
    return `${prefix}${span('string', value.trim())}`;
  });
  return result;
}

function highlightMarkup(source) {
  let result = source;
  result = applyPattern(result, /(&lt;\/?)([\w-]+)/g, (match, open, tag) => {
    if (match.includes('style="color:')) {
      return match;
    }
    return `${open}${span('tag', tag)}`;
  });
  result = applyPattern(result, /([\w-]+)(=)/g, (match, attr, eq) => {
    if (match.includes('style="color:')) {
      return match;
    }
    return `${span('attribute', attr)}${eq}`;
  });
  result = applyPattern(result, /(=)(&quot;(?:\\.|[^&])*?&quot;)/g, (match, eq, str) => `${eq}${span('string', str)}`);
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

function highlightCode(code, language) {
  const lang = normalizeLanguage(language);
  const escaped = escapeHtml(String(code || ''));
  const highlighter = HIGHLIGHTERS[lang] || highlightGeneric;
  const body = highlighter(escaped);

  return `<div style="font-family:'SF Mono',ui-monospace,Menlo,monospace;font-size:13px;line-height:1.55;white-space:pre-wrap;word-break:break-all;color:${COLORS.default}">${body}</div>`;
}

module.exports = {
  highlightCode,
  normalizeLanguage
};
