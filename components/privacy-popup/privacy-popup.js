Component({
  data: {
    show: false
  },

  lifetimes: {
    attached() {
      this._handler = (resolve) => {
        this._resolve = resolve;
        this.setData({ show: true });
      };

      if (wx.onNeedPrivacyAuthorization) {
        wx.onNeedPrivacyAuthorization(this._handler);
      }
    },

    detached() {
      if (this._handler && wx.offNeedPrivacyAuthorization) {
        wx.offNeedPrivacyAuthorization(this._handler);
      }
      this._resolve = null;
    }
  },

  methods: {
    noop() {},

    openPrivacyContract() {
      if (wx.openPrivacyContract) {
        wx.openPrivacyContract();
      }
    },

    handleAgree() {
      if (this._resolve) {
        this._resolve({
          event: 'agree',
          buttonId: 'privacy-agree-btn'
        });
      }
      this._resolve = null;
      this.setData({ show: false });
    },

    handleDisagree() {
      if (this._resolve) {
        this._resolve({ event: 'disagree' });
      }
      this._resolve = null;
      this.setData({ show: false });
      wx.showToast({
        title: '需同意隐私协议才能选图',
        icon: 'none',
        duration: 3000
      });
    }
  }
});
