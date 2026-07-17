const { highlightCode } = require('./highlight.js');

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function applyInlineMarkdown(text) {
  let result = escapeHtml(text);

  result = result.replace(/`([^`\n]+)`/g, '<code style="background:rgba(118,118,128,0.12);padding:2px 6px;border-radius:4px;font-family:SF Mono,Menlo,monospace;font-size:0.9em;color:#1c1c1e;">$1</code>');
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  result = result.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" style="color:#9a7b4f;">$1</a>');

  return result;
}

function parseTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableRow(line) {
  const trimmed = line.trim();
  return trimmed.includes('|') && !/^[\|\s\-:]+$/.test(trimmed);
}

function isTableSeparator(line) {
  return /^\|?[\s\-:|]+\|?$/.test(line.trim());
}

function flushList(blocks, items, ordered) {
  if (!items.length) {
    return;
  }

  blocks.push({
    type: 'list',
    ordered,
    items: items.map((item) => {
      if (typeof item === 'string') {
        return {
          marker: ordered ? '' : '•',
          html: applyInlineMarkdown(item)
        };
      }

      return {
        marker: item.marker,
        html: applyInlineMarkdown(item.text)
      };
    })
  });
  items.length = 0;
}

function flushParagraph(blocks, lines) {
  if (!lines.length) {
    return;
  }

  const html = lines.map((line) => applyInlineMarkdown(line)).join('<br/>');
  blocks.push({
    type: 'paragraph',
    html
  });
  lines.length = 0;
}

function padTableRow(row, columnCount) {
  const cells = row.slice();
  while (cells.length < columnCount) {
    cells.push('');
  }
  return cells.slice(0, columnCount);
}

function getTableColumnCount(headers, rows) {
  const lengths = [headers.length, ...rows.map((row) => row.length)];
  return Math.max(0, ...lengths);
}

function shouldDemoteHeader(headers, rows) {
  if (!headers.length || !rows.length) {
    return false;
  }

  const headerKey = headers[1] || '';
  const isCamelCase = /^[a-z][\w$]*$/i.test(headerKey);
  if (!isCamelCase) {
    return false;
  }

  return rows.every((row) => /^[a-z][\w$]*$/i.test(row[1] || ''));
}

function trimEmptyColumns(headers, rows) {
  const columnCount = getTableColumnCount(headers, rows);
  if (!columnCount) {
    return { headers, rows, columnCount: 0 };
  }

  const keepIndexes = [];
  for (let col = 0; col < columnCount; col += 1) {
    const headerFilled = !!(headers[col] && String(headers[col]).trim());
    const rowFilled = rows.some((row) => row[col] && String(row[col]).trim());
    if (headerFilled || rowFilled) {
      keepIndexes.push(col);
    }
  }

  if (!keepIndexes.length) {
    return { headers, rows, columnCount };
  }

  return {
    headers: headers.length ? keepIndexes.map((i) => headers[i] || '') : [],
    rows: rows.map((row) => keepIndexes.map((i) => row[i] || '')),
    columnCount: keepIndexes.length
  };
}

function getTableCellWidth(columnCount) {
  if (columnCount <= 2) {
    return 320;
  }
  if (columnCount === 3) {
    return 230;
  }
  if (columnCount === 4) {
    return 200;
  }
  return 180;
}

function parseTable(lines, startIndex) {
  let headers = [];
  let hasHeader = false;
  const rows = [];
  let index = startIndex;
  const firstRow = parseTableRow(lines[index]);
  index += 1;

  if (index < lines.length && isTableSeparator(lines[index])) {
    headers = firstRow;
    hasHeader = true;
    index += 1;
  } else {
    rows.push(firstRow);
  }

  while (index < lines.length && isTableRow(lines[index])) {
    rows.push(parseTableRow(lines[index]));
    index += 1;
  }

  const columnCount = getTableColumnCount(hasHeader ? headers : [], rows);
  let normalizedHeaders = hasHeader ? padTableRow(headers, columnCount) : [];
  let normalizedRows = rows.map((row) => padTableRow(row, columnCount));

  if (hasHeader && shouldDemoteHeader(normalizedHeaders, normalizedRows)) {
    normalizedRows = [normalizedHeaders, ...normalizedRows];
    normalizedHeaders = [];
    hasHeader = false;
  }

  const trimmed = trimEmptyColumns(normalizedHeaders, normalizedRows);
  const cellWidth = getTableCellWidth(trimmed.columnCount);

  return {
    consumed: index - startIndex,
    block: {
      type: 'table',
      headers: trimmed.headers,
      rows: trimmed.rows,
      hasHeader,
      columnCount: trimmed.columnCount,
      cellStyle: `width:${cellWidth}rpx;min-width:${cellWidth}rpx;max-width:${cellWidth}rpx;`,
      tableStyle: `width:${cellWidth * trimmed.columnCount}rpx;min-width:100%;`
    }
  };
}

function parseMarkdown(markdown) {
  if (!markdown) {
    return [];
  }

  const normalized = String(markdown).replace(/\r\n/g, '\n');
  const codeBlocks = [];
  const withoutCodeBlocks = normalized.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, language, code) => {
    const index = codeBlocks.length;
    codeBlocks.push({
      type: 'code',
      language: (language || 'code').toUpperCase(),
      content: code.replace(/\n$/, ''),
      html: highlightCode(code.replace(/\n$/, ''), language)
    });
    return `@@CODE_BLOCK_${index}@@`;
  });

  const lines = withoutCodeBlocks.split('\n');
  const blocks = [];
  let paragraphLines = [];
  let unorderedItems = [];
  let orderedItems = [];
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index];
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph(blocks, paragraphLines);
      flushList(blocks, unorderedItems, false);
      flushList(blocks, orderedItems, true);
      index += 1;
      continue;
    }

    if (isTableRow(trimmed)) {
      flushParagraph(blocks, paragraphLines);
      flushList(blocks, unorderedItems, false);
      flushList(blocks, orderedItems, true);
      const tableResult = parseTable(lines, index);
      blocks.push(tableResult.block);
      index += tableResult.consumed;
      continue;
    }

    const codePlaceholder = trimmed.match(/^@@CODE_BLOCK_(\d+)@@$/);
    if (codePlaceholder) {
      flushParagraph(blocks, paragraphLines);
      flushList(blocks, unorderedItems, false);
      flushList(blocks, orderedItems, true);
      blocks.push(codeBlocks[Number(codePlaceholder[1])]);
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph(blocks, paragraphLines);
      flushList(blocks, unorderedItems, false);
      flushList(blocks, orderedItems, true);
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2]
      });
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      flushParagraph(blocks, paragraphLines);
      flushList(blocks, unorderedItems, false);
      flushList(blocks, orderedItems, true);
      blocks.push({ type: 'hr' });
      index += 1;
      continue;
    }

    const blockquoteMatch = trimmed.match(/^>\s?(.*)$/);
    if (blockquoteMatch) {
      flushParagraph(blocks, paragraphLines);
      flushList(blocks, unorderedItems, false);
      flushList(blocks, orderedItems, true);
      blocks.push({
        type: 'blockquote',
        html: applyInlineMarkdown(blockquoteMatch[1])
      });
      index += 1;
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph(blocks, paragraphLines);
      flushList(blocks, orderedItems, true);
      unorderedItems.push({
        marker: '•',
        text: unorderedMatch[1]
      });
      index += 1;
      continue;
    }

    const orderedMatch = trimmed.match(/^(\d+)([.、)])\s*(.+)$/);
    if (orderedMatch) {
      flushParagraph(blocks, paragraphLines);
      flushList(blocks, unorderedItems, false);
      orderedItems.push({
        marker: `${orderedMatch[1]}、`,
        text: orderedMatch[3]
      });
      index += 1;
      continue;
    }

    flushList(blocks, unorderedItems, false);
    flushList(blocks, orderedItems, true);
    paragraphLines.push(line);
    index += 1;
  }

  flushParagraph(blocks, paragraphLines);
  flushList(blocks, unorderedItems, false);
  flushList(blocks, orderedItems, true);

  return blocks;
}

function markdownToHtml(markdown) {
  const blocks = parseMarkdown(markdown);
  if (!blocks.length) {
    return '';
  }

  return blocks.map((block) => {
    switch (block.type) {
      case 'heading':
        return `<h${block.level}>${applyInlineMarkdown(block.text)}</h${block.level}>`;
      case 'paragraph':
        return `<p>${block.html}</p>`;
      case 'code':
        return `<pre><code>${escapeHtml(block.content)}</code></pre>`;
      case 'blockquote':
        return `<blockquote>${block.html}</blockquote>`;
      case 'list':
        return block.ordered
          ? `<ol>${block.items.map((item) => `<li>${item.html || item}</li>`).join('')}</ol>`
          : `<ul>${block.items.map((item) => `<li>${item.html || item}</li>`).join('')}</ul>`;
      case 'hr':
        return '<hr/>';
      default:
        return '';
    }
  }).join('');
}

module.exports = {
  parseMarkdown,
  markdownToHtml
};
