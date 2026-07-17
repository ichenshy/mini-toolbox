Page({
  data: {
    pageStyleGlobal: ''
  },

  onLoad() {
    this.loadPageLayoutInfo();
  },

  loadPageLayoutInfo() {
    const windowInfo = wx.getWindowInfo();
    this.setData({
      pageStyleGlobal: `--status-bar-height: ${windowInfo.statusBarHeight}px;`
    });
  },

  goToPdfMaker() {
    wx.navigateTo({
      url: '/pages/pdf-maker/pdf-maker'
    });
  },

  goToMdPreview() {
    wx.navigateTo({
      url: '/pages/md-preview/md-preview'
    });
  }
});
