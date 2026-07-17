const { getChatMaterial, getChatMaterialOptions } = require('../../utils/material.js');
const { parseMarkdown } = require('../../utils/markdown.js');
const { saveMarkdownHistory, isHistoryPath } = require('../../utils/md-history.js');

function normalizeTitle(text) {
  return String(text || '')
    .trim()
    .replace(/\.md$/i, '');
}

function dedupeHeadingBlocks(blocks, fileName) {
  if (!blocks.length || blocks[0].type !== 'heading' || blocks[0].level !== 1) {
    return blocks;
  }

  const fileTitle = normalizeTitle(fileName);
  const headingTitle = normalizeTitle(blocks[0].text);

  if (fileTitle && headingTitle && fileTitle === headingTitle) {
    return blocks.slice(1);
  }

  return blocks;
}

Page({
  data: {
    displayTitle: '',
    blocks: [],
    rawContent: '',
    viewMode: 'read',
    loading: false,
    error: '',
    empty: true,
    pageStyleGlobal: ''
  },

  onLoad(options) {
    this.loadPageLayoutInfo();

    if (options?.filePath) {
      const filePath = decodeURIComponent(options.filePath);
      const name = options.name ? decodeURIComponent(options.name) : '未命名.md';
      this.loadMarkdownFile({
        path: filePath,
        name
      });
      return;
    }

    this.bootstrapMaterial();
  },

  onUnload() {
    this.clearRetryTimers();
  },

  onShow() {
    if (this.data.rawContent || this.data.loading) {
      return;
    }
    this.tryLoadMaterial();
  },

  loadPageLayoutInfo() {
    const windowInfo = wx.getWindowInfo();
    const menuRect = wx.getMenuButtonBoundingClientRect();
    const capsuleGap = Math.max(windowInfo.windowWidth - menuRect.left + 8, 96);

    this.setData({
      pageStyleGlobal: `--status-bar-height: ${windowInfo.statusBarHeight}px; --capsule-right: ${capsuleGap}px;`
    });
  },

  bootstrapMaterial() {
    const material = getChatMaterial();
    if (material) {
      this.loadMarkdownFile(material);
      this.scheduleMaterialRetry();
      return;
    }

    const options = getChatMaterialOptions();
    if (options?.forwardMaterials?.length) {
      this.scheduleMaterialRetry();
    }
  },

  scheduleMaterialRetry() {
    this.clearRetryTimers();
    this._retryTimers = [120, 360, 900].map((delay) => {
      return setTimeout(() => this.tryLoadMaterial(), delay);
    });
  },

  clearRetryTimers() {
    if (!this._retryTimers) {
      return;
    }
    this._retryTimers.forEach(clearTimeout);
    this._retryTimers = null;
  },

  tryLoadMaterial() {
    const material = getChatMaterial();
    if (!material) {
      return;
    }
    this.loadMarkdownFile(material);
  },

  loadMarkdownFile(material) {
    const { path, name } = material;

    if (!path) {
      this.setData({
        empty: true,
        error: '未获取到文件路径',
        loading: false
      });
      return;
    }

    if (this._currentPath === path && this.data.rawContent) {
      return;
    }

    const displayTitle = name || '未命名.md';
    this._currentPath = path;
    this._loadToken = (this._loadToken || 0) + 1;
    const loadToken = this._loadToken;

    this.setData({
      loading: true,
      empty: false,
      error: '',
      blocks: [],
      rawContent: '',
      viewMode: 'read',
      displayTitle
    });

    wx.getFileSystemManager().readFile({
      filePath: path,
      encoding: 'utf8',
      success: (res) => {
        if (loadToken !== this._loadToken) {
          return;
        }

        const content = String(res.data || '');
        if (!content) {
          this.setData({
            rawContent: '',
            blocks: [],
            loading: false,
            empty: true,
            error: '文件内容为空'
          });
          return;
        }

        setTimeout(() => {
          if (loadToken !== this._loadToken) {
            return;
          }

          const blocks = dedupeHeadingBlocks(parseMarkdown(content), displayTitle);
          this.setData({
            rawContent: content,
            blocks,
            loading: false,
            empty: false,
            error: ''
          });
          this.clearRetryTimers();
          this.persistHistory({
            name: displayTitle,
            content,
            sourcePath: path,
            loadToken
          });
        }, 0);
      },
      fail: (err) => {
        if (loadToken !== this._loadToken) {
          return;
        }
        console.error('读取 Markdown 文件失败:', err);
        this.setData({
          loading: false,
          empty: true,
          error: `读取文件失败：${err.errMsg || '请重试'}`
        });
      }
    });
  },

  async persistHistory({ name, content, sourcePath, loadToken }) {
    if (loadToken !== this._loadToken || isHistoryPath(sourcePath)) {
      return;
    }

    try {
      const savedPath = await saveMarkdownHistory({
        name,
        content,
        sourcePath
      });
      if (savedPath && loadToken === this._loadToken) {
        this._currentPath = savedPath;
      }
    } catch (error) {
      console.error('保存 Markdown 历史失败:', error);
    }
  },

  switchViewMode(e) {
    const { mode } = e.currentTarget.dataset;
    if (mode && mode !== this.data.viewMode) {
      this.setData({ viewMode: mode });
    }
  },

  goHome() {
    const pages = getCurrentPages();
    if (pages.length <= 1) {
      wx.exitMiniProgram({
        fail: () => {
          wx.reLaunch({
            url: '/pages/home/home'
          });
        }
      });
      return;
    }

    wx.navigateBack({
      fail: () => {
        wx.reLaunch({
          url: '/pages/home/home'
        });
      }
    });
  },

  goToHistory() {
    wx.navigateTo({
      url: '/pages/md-history/md-history'
    });
  },

  copyToClipboard(data) {
    if (!data) {
      return;
    }

    wx.setClipboardData({
      data,
      success: () => {
        wx.showToast({
          title: '已复制',
          icon: 'success'
        });
      },
      fail: () => {
        wx.showToast({
          title: '复制失败',
          icon: 'none'
        });
      }
    });
  },

  copyCode(e) {
    const { index } = e.currentTarget.dataset;
    const block = this.data.blocks[index];

    if (!block || block.type !== 'code' || !block.content) {
      return;
    }

    this.copyToClipboard(block.content);
  },

  copySource() {
    this.copyToClipboard(this.data.rawContent);
  },

  chooseMarkdownFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      success: (res) => {
        const file = res.tempFiles[0];
        if (!file || !/\.md$/i.test(file.name || '')) {
          wx.showToast({
            title: '请选择 .md 文件',
            icon: 'none'
          });
          return;
        }

        this._currentPath = '';
        this.loadMarkdownFile({
          path: file.path,
          name: file.name,
          size: file.size,
          type: 'text/markdown'
        });
      }
    });
  }
});
