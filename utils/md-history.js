const HISTORY_DIR_NAME = 'md-history';

function getHistoryDir() {
  return `${wx.env.USER_DATA_PATH}/${HISTORY_DIR_NAME}`;
}

function isHistoryPath(filePath) {
  if (!filePath) {
    return false;
  }
  return String(filePath).indexOf(`/${HISTORY_DIR_NAME}/`) !== -1
    || String(filePath).indexOf(`\\${HISTORY_DIR_NAME}\\`) !== -1;
}

function sanitizeFileName(name) {
  let base = String(name || '未命名.md').trim() || '未命名.md';
  base = base.replace(/[\\/:*?"<>|]/g, '_');
  if (!/\.md$/i.test(base)) {
    base += '.md';
  }
  return base;
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) {
    return '0 B';
  }
  if (typeof bytes !== 'number' || Number.isNaN(bytes)) {
    return '未知大小';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatTimestamp(timestamp) {
  try {
    if (!timestamp) {
      return '未知时间';
    }
    const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
    const date = new Date(ms);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  } catch (error) {
    return '未知时间';
  }
}

function ensureHistoryDir() {
  return new Promise((resolve, reject) => {
    const dirPath = getHistoryDir();
    const fs = wx.getFileSystemManager();
    fs.access({
      path: dirPath,
      success: () => resolve(dirPath),
      fail: () => {
        fs.mkdir({
          dirPath,
          recursive: true,
          success: () => resolve(dirPath),
          fail: reject
        });
      }
    });
  });
}

function writeHistoryFile(filePath, content) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().writeFile({
      filePath,
      data: content,
      encoding: 'utf8',
      success: () => resolve(filePath),
      fail: reject
    });
  });
}

function readDirFiles(dirPath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readdir({
      dirPath,
      success: (res) => resolve(res.files || []),
      fail: reject
    });
  });
}

function getFileStats(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().stat({
      path: filePath,
      success: resolve,
      fail: reject
    });
  });
}

function unlinkFile(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().unlink({
      filePath,
      success: resolve,
      fail: reject
    });
  });
}

async function saveMarkdownHistory({ name, content, sourcePath }) {
  if (!content) {
    return null;
  }

  const dirPath = await ensureHistoryDir();

  if (isHistoryPath(sourcePath)) {
    return sourcePath;
  }

  const fileName = sanitizeFileName(name);
  const filePath = `${dirPath}/${fileName}`;
  await writeHistoryFile(filePath, content);
  return filePath;
}

async function listMarkdownHistory() {
  const dirPath = getHistoryDir();

  try {
    await ensureHistoryDir();
    const files = await readDirFiles(dirPath);
    const mdFiles = files.filter((file) => /\.md$/i.test(file));
    const items = [];

    for (const fileName of mdFiles) {
      const filePath = `${dirPath}/${fileName}`;
      try {
        const statsResult = await getFileStats(filePath);
        const stats = statsResult.stats || statsResult;
        const size = stats.size || 0;
        const lastModifiedTime = stats.lastModifiedTime || stats.lastAccessedTime || Date.now() / 1000;

        items.push({
          fileName,
          filePath,
          createTime: formatTimestamp(lastModifiedTime),
          sortTime: lastModifiedTime > 1e12 ? lastModifiedTime : lastModifiedTime * 1000,
          fileSize: formatFileSize(size)
        });
      } catch (error) {
        items.push({
          fileName,
          filePath,
          createTime: '未知时间',
          sortTime: 0,
          fileSize: '未知大小'
        });
      }
    }

    items.sort((a, b) => b.sortTime - a.sortTime);
    return items;
  } catch (error) {
    console.error('读取 Markdown 历史失败:', error);
    return [];
  }
}

async function deleteMarkdownHistory(filePath) {
  if (!isHistoryPath(filePath)) {
    throw new Error('只能删除历史副本');
  }
  await unlinkFile(filePath);
}

async function clearMarkdownHistory() {
  const items = await listMarkdownHistory();
  await Promise.all(items.map((item) => unlinkFile(item.filePath).catch(() => null)));
  return items.length;
}

module.exports = {
  getHistoryDir,
  isHistoryPath,
  saveMarkdownHistory,
  listMarkdownHistory,
  deleteMarkdownHistory,
  clearMarkdownHistory
};
