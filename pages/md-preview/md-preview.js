const { getChatMaterial, getChatMaterialOptions } = require('../../utils/material.js');
const { markdownToHtml } = require('../../utils/md-render.js');
const { saveMarkdownHistory, isHistoryPath } = require('../../utils/md-history.js');
const { readFileCompat } = require('../../utils/read-file.js');

function normalizeTitle(text) {
  return String(text || '')
    .trim()
    .replace(/\.md$/i, '');
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripDuplicateTitle(markdown, fileName) {
  const title = normalizeTitle(fileName);
  if (!title) {
    return markdown;
  }

  const pattern = new RegExp(`^\\s*#\\s+${escapeRegExp(title)}\\s*\\n+`, 'i');
  return String(markdown || '').replace(pattern, '');
}

/** mp-html 标签样式，贴近暖纸主题 */
const MD_TAG_STYLE = {
  h1: 'font-size:28px;font-weight:700;line-height:1.3;color:#2c2416;margin:8px 0 12px;letter-spacing:-0.3px;',
  h2: 'font-size:22px;font-weight:700;line-height:1.35;color:#2c2416;margin:20px 0 10px;letter-spacing:-0.2px;',
  h3: 'font-size:18px;font-weight:600;line-height:1.4;color:#2c2416;margin:16px 0 8px;',
  h4: 'font-size:15px;font-weight:600;line-height:1.4;color:rgba(74,58,36,0.68);margin:14px 0 8px;',
  h5: 'font-size:15px;font-weight:600;line-height:1.4;color:rgba(74,58,36,0.68);margin:12px 0 6px;',
  h6: 'font-size:15px;font-weight:600;line-height:1.4;color:rgba(74,58,36,0.68);margin:12px 0 6px;',
  p: 'font-size:15px;line-height:1.65;color:#2c2416;margin:0 0 12px;letter-spacing:-0.1px;',
  li: 'font-size:15px;line-height:1.55;color:#2c2416;margin:4px 0;',
  ul: 'padding-left:22px;margin:0 0 12px;',
  ol: 'padding-left:22px;margin:0 0 12px;',
  blockquote: 'margin:0 0 14px;padding:10px 14px;border-left:4px solid #d4b896;background:#fff9f0;color:rgba(74,58,36,0.68);font-size:15px;line-height:1.55;',
  a: 'color:#9a7b4f;text-decoration:underline;',
  table: 'border-collapse:collapse;width:100%;font-size:13px;margin:0 0 14px;background:#fffcf7;',
  th: 'border:1px solid rgba(120,90,50,0.12);padding:8px 10px;background:#efe6d8;color:rgba(74,58,36,0.68);font-weight:600;text-align:left;',
  td: 'border:1px solid rgba(120,90,50,0.12);padding:8px 10px;color:#2c2416;',
  hr: 'border:none;border-top:1px solid rgba(120,90,50,0.16);margin:16px 0;',
  img: 'max-width:100%;border-radius:8px;margin:8px 0;'
};

Page({
  data: {
    displayTitle: '',
    htmlContent: '',
    rawContent: '',
    viewMode: 'read',
    loading: false,
    error: '',
    pageStyleGlobal: '',
    tagStyle: MD_TAG_STYLE
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

  renderMarkdown(content, displayTitle) {
    const markdown = stripDuplicateTitle(content, displayTitle);
    return markdownToHtml(markdown);
  },

  loadMarkdownFile(material) {
    const { path, name } = material;

    if (!path) {
      this.setData({
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
      error: '',
      htmlContent: '',
      rawContent: '',
      viewMode: 'read',
      displayTitle
    });

    readFileCompat(path, { encoding: 'utf8' })
      .then((data) => {
        if (loadToken !== this._loadToken) {
          return;
        }

        const content = String(data || '');
        if (!content) {
          this.setData({
            rawContent: '',
            htmlContent: '',
            loading: false,
            error: '文件内容为空'
          });
          return;
        }

        setTimeout(() => {
          if (loadToken !== this._loadToken) {
            return;
          }

          let htmlContent = '';
          try {
            htmlContent = this.renderMarkdown(content, displayTitle);
          } catch (error) {
            console.error('Markdown 渲染失败:', error);
            this.setData({
              loading: false,
              error: '文档解析失败，请检查 Markdown 格式'
            });
            return;
          }

          this.setData({
            rawContent: content,
            htmlContent,
            loading: false,
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
      })
      .catch((err) => {
        if (loadToken !== this._loadToken) {
          return;
        }
        console.error('读取 Markdown 文件失败:', err);
        this.setData({
          loading: false,
          error: `读取文件失败：${(err && err.errMsg) || '请重试'}`
        });
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
      },
      fail: (err) => {
        console.error('选择聊天文件失败:', err);
        if (err.errMsg && /cancel/.test(err.errMsg)) {
          return;
        }
        let title = '无法打开聊天文件';
        if (err.errno === 112 || err.errno === 101100) {
          title = '后台需声明「收集你选中的文件」';
        } else if (err.errno === 101102) {
          title = '需先同意隐私协议';
        }
        wx.showToast({
          title,
          icon: 'none',
          duration: 3000
        });
      }
    });
  }
});
