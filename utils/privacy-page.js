const {
  onPrivacyNeed,
  resolvePrivacyAuthorization,
  promptPrivacyIfNeeded
} = require('./privacy.js');

function bindPrivacyPage(page) {
  page.onLoadPrivacy = function onLoadPrivacy() {
    this._offPrivacyNeed = onPrivacyNeed(() => {
      this.setData({ showPrivacy: true });
      console.info('[privacy-page] 展示页面级隐私弹窗');
    });
  };

  page.onUnloadPrivacy = function onUnloadPrivacy() {
    if (this._offPrivacyNeed) {
      this._offPrivacyNeed();
      this._offPrivacyNeed = null;
    }
  };

  page.ensurePrivacyAuthorized = function ensurePrivacyAuthorized() {
    promptPrivacyIfNeeded().catch(() => {});
  };

  page.openPrivacyContract = function openPrivacyContract() {
    if (wx.openPrivacyContract) {
      wx.openPrivacyContract();
    }
  };

  page.handlePrivacyAgree = function handlePrivacyAgree() {
    resolvePrivacyAuthorization({
      event: 'agree',
      buttonId: 'privacy-agree-btn'
    });
    this.setData({ showPrivacy: false });
  };

  page.handlePrivacyDisagree = function handlePrivacyDisagree() {
    resolvePrivacyAuthorization({ event: 'disagree' });
    this.setData({ showPrivacy: false });
    wx.showToast({
      title: '需同意隐私协议才能选文件',
      icon: 'none',
      duration: 3000
    });
  };

  page.privacyNoop = function privacyNoop() {};
}

module.exports = {
  bindPrivacyPage
};
