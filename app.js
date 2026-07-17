// app.js
// 首先加载polyfills
require('./utils/polyfills.umd.js');

const { CHAT_MATERIAL_SCENE, storeForwardMaterials } = require('./utils/material.js');

App({
  onLaunch(options) {
    storeForwardMaterials(options);
  },

  onShow(options) {
    storeForwardMaterials(options);

    if (options.scene !== CHAT_MATERIAL_SCENE || !options.forwardMaterials?.length) {
      return;
    }

    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    if (currentPage && currentPage.route === 'pages/md-preview/md-preview') {
      return;
    }

    // 冷启动会由 supportedMaterials.path 直接进入预览页
    if (!pages.length) {
      return;
    }

    wx.navigateTo({
      url: '/pages/md-preview/md-preview'
    });
  },

  globalData: {
    forwardMaterials: null,
    chatMaterialScene: null
  }
})
