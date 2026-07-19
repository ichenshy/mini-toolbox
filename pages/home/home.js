const { getMiniProgramVersionLabel } = require('../../utils/version.js');

Page({
  data: {
    pageStyleGlobal: '',
    version: ''
  },

  onLoad() {
    this.loadPageLayoutInfo();
    this.setData({
      version: getMiniProgramVersionLabel()
    });
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
