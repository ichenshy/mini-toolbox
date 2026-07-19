// app.js
// 首先加载polyfills
require('./utils/polyfills.umd.js');

const { CHAT_MATERIAL_SCENE, storeForwardMaterials } = require('./utils/material.js');
const { initPrivacyAuthorization } = require('./utils/privacy.js');

App({
  onLaunch(options) {
    initPrivacyAuthorization();
    storeForwardMaterials(options);
  },

  onShow(options) {
    storeForwardMaterials(options);

    if (options.scene !== CHAT_MATERIAL_SCENE || !options.forwardMaterials?.length) {
      return;
    }

    const pages = getCurrentPages();
    // 冷启动由 supportedMaterials.path 直接进入预览页
    if (!pages.length) {
      return;
    }

    const hasPreview = pages.some((page) => page.route === 'pages/md-preview/md-preview');
    if (hasPreview) {
      return;
    }

    // 热启动时清空页面栈，只保留预览页，避免叠两层
    wx.reLaunch({
      url: '/pages/md-preview/md-preview'
    });
  },

  globalData: {
    forwardMaterials: null,
    chatMaterialScene: null
  }
})
