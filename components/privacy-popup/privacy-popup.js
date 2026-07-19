const { onPrivacyNeed, resolvePrivacyAuthorization } = require('../../utils/privacy.js');

Component({
  data: {
    show: false
  },

  lifetimes: {
    attached() {
      this._offPrivacyNeed = onPrivacyNeed(({ resolve, proactive }) => {
        this.showPrivacy(resolve, proactive);
      });
    },

    detached() {
      if (this._offPrivacyNeed) {
        this._offPrivacyNeed();
        this._offPrivacyNeed = null;
      }
      this._resolve = null;
    }
  },

  methods: {
    showPrivacy(resolve, proactive) {
      this._resolve = resolve || null;
      this.setData({ show: true });

      if (proactive) {
        console.info('[privacy-popup] 主动展示隐私弹窗');
      }
    },

    noop() {},

    openPrivacyContract() {
      if (wx.openPrivacyContract) {
        wx.openPrivacyContract();
      }
    },

    handleAgree() {
      resolvePrivacyAuthorization({
        event: 'agree',
        buttonId: 'privacy-agree-btn'
      });
      this._resolve = null;
      this.setData({ show: false });
    },

    handleDisagree() {
      resolvePrivacyAuthorization({ event: 'disagree' });
      this._resolve = null;
      this.setData({ show: false });
      wx.showToast({
        title: '需同意隐私协议才能选文件',
        icon: 'none',
        duration: 3000
      });
    }
  }
});
