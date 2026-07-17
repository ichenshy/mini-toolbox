const CHAT_MATERIAL_SCENE = 1173;

function storeForwardMaterials(options) {
  if (!options?.forwardMaterials?.length) {
    return;
  }

  try {
    const app = getApp();
    if (app) {
      app.globalData.forwardMaterials = options.forwardMaterials;
      app.globalData.chatMaterialScene = options.scene;
    }
  } catch (error) {
    // getApp 在 App 注册前不可用
  }
}

function getChatMaterialOptions() {
  try {
    const app = getApp();
    if (app?.globalData?.forwardMaterials?.length) {
      return {
        scene: app.globalData.chatMaterialScene,
        forwardMaterials: app.globalData.forwardMaterials
      };
    }
  } catch (error) {
    // ignore
  }

  if (typeof wx.getEnterOptionsSync === 'function') {
    const enterOptions = wx.getEnterOptionsSync();
    if (enterOptions.forwardMaterials?.length) {
      return enterOptions;
    }
  }

  if (typeof wx.getLaunchOptionsSync === 'function') {
    const launchOptions = wx.getLaunchOptionsSync();
    if (launchOptions.forwardMaterials?.length) {
      return launchOptions;
    }
  }

  return null;
}

function getChatMaterial() {
  const options = getChatMaterialOptions();
  return options?.forwardMaterials?.[0] || null;
}

module.exports = {
  CHAT_MATERIAL_SCENE,
  storeForwardMaterials,
  getChatMaterialOptions,
  getChatMaterial
};
