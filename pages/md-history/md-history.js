const {
  listMarkdownHistory,
  deleteMarkdownHistory,
  clearMarkdownHistory
} = require('../../utils/md-history.js');

Page({
  data: {
    historyList: [],
    pageStyleGlobal: ''
  },

  onLoad() {
    this.loadPageLayoutInfo();
    this.loadHistoryList();
  },

  onShow() {
    this.loadHistoryList();
  },

  loadPageLayoutInfo() {
    const windowInfo = wx.getWindowInfo();
    this.setData({
      pageStyleGlobal: `--status-bar-height: ${windowInfo.statusBarHeight}px;`
    });
  },

  async loadHistoryList() {
    try {
      const historyList = await listMarkdownHistory();
      this.setData({ historyList });
    } catch (error) {
      console.error('加载 Markdown 历史失败:', error);
      this.setData({ historyList: [] });
    }
  },

  openMarkdown(e) {
    const { filePath, fileName } = e.currentTarget.dataset;
    if (!filePath) {
      return;
    }

    const url = `/pages/md-preview/md-preview?filePath=${encodeURIComponent(filePath)}&name=${encodeURIComponent(fileName || '')}`;
    wx.navigateTo({
      url,
      fail: (err) => {
        console.error('打开历史文档失败:', err);
        wx.showToast({
          title: '打开失败',
          icon: 'none'
        });
      }
    });
  },

  shareMarkdown(e) {
    const { filePath, fileName } = e.currentTarget.dataset;
    this.shareLocalFile(filePath, fileName);
  },

  shareLocalFile(filePath, fileName) {
    if (!filePath) {
      wx.showToast({
        title: '文件不存在',
        icon: 'none'
      });
      return;
    }

    if (!wx.canIUse('shareFileMessage')) {
      wx.showToast({
        title: '当前微信版本不支持分享文件',
        icon: 'none'
      });
      return;
    }

    wx.shareFileMessage({
      filePath,
      fileName: fileName || '',
      fail: (err) => {
        const msg = String((err && err.errMsg) || '');
        // 用户取消分享也会走 fail，不提示错误
        if (/cancel/i.test(msg)) {
          return;
        }
        console.error('分享文件失败:', err);
        wx.showToast({
          title: /开发者工具|devtools/i.test(msg)
            ? '分享失败，请在真机重试'
            : '分享失败',
          icon: 'none'
        });
      }
    });
  },

  deleteMarkdown(e) {
    const { filePath, fileName } = e.currentTarget.dataset;

    wx.showModal({
      title: '确认删除',
      content: `确定删除本地副本「${fileName}」吗？`,
      confirmColor: '#b85c4a',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        try {
          await deleteMarkdownHistory(filePath);
          wx.showToast({
            title: '已删除',
            icon: 'success'
          });
          this.loadHistoryList();
        } catch (error) {
          console.error('删除 Markdown 历史失败:', error);
          wx.showToast({
            title: '删除失败',
            icon: 'none'
          });
        }
      }
    });
  },

  clearAllHistory() {
    if (!this.data.historyList.length) {
      wx.showToast({
        title: '没有可删除的文件',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认清空',
      content: `确定删除全部 ${this.data.historyList.length} 个本地副本吗？此操作不可恢复。`,
      confirmColor: '#b85c4a',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        wx.showLoading({ title: '正在删除...' });
        try {
          await clearMarkdownHistory();
          wx.hideLoading();
          wx.showToast({
            title: '清空成功',
            icon: 'success'
          });
          this.loadHistoryList();
        } catch (error) {
          wx.hideLoading();
          console.error('清空 Markdown 历史失败:', error);
          wx.showToast({
            title: '清空失败',
            icon: 'none'
          });
        }
      }
    });
  },

  goBack() {
    wx.navigateBack({
      fail: () => {
        wx.redirectTo({
          url: '/pages/md-preview/md-preview'
        });
      }
    });
  }
});
