let pendingResolve = null;
const listeners = new Set();
/** @type {Array<{ resolve: Function, reject: Function }>} */
let pendingWaiters = [];
let activePrompt = null;

function notifyPrivacyShow(payload) {
  listeners.forEach((listener) => {
    listener(payload);
  });
}

function showPrivacyOnCurrentPage() {
  const pages = getCurrentPages();
  const page = pages[pages.length - 1];
  if (page && typeof page.setData === 'function') {
    page.setData({ showPrivacy: true });
    console.info('[privacy] 页面级兜底展示');
  }
}

function initPrivacyAuthorization() {
  if (!wx.onNeedPrivacyAuthorization) {
    return;
  }

  wx.onNeedPrivacyAuthorization((resolve, eventInfo) => {
    pendingResolve = resolve;
    notifyPrivacyShow({ resolve, eventInfo, proactive: false });
    setTimeout(showPrivacyOnCurrentPage, 80);
  });
}

function onPrivacyNeed(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function checkPrivacyNeeded() {
  return new Promise((resolve) => {
    if (!wx.getPrivacySetting) {
      resolve(false);
      return;
    }

    wx.getPrivacySetting({
      success: (res) => resolve(!!res.needAuthorization),
      fail: () => resolve(false)
    });
  });
}

function promptPrivacyIfNeeded() {
  if (activePrompt) {
    return activePrompt;
  }

  activePrompt = checkPrivacyNeeded().then((needed) => {
    if (!needed) {
      return;
    }

    return new Promise((resolve, reject) => {
      pendingWaiters.push({ resolve, reject });
      notifyPrivacyShow({ resolve: null, proactive: true });
      setTimeout(showPrivacyOnCurrentPage, 80);
    });
  }).finally(() => {
    activePrompt = null;
  });

  return activePrompt;
}

function resolvePrivacyAuthorization(result) {
  if (pendingResolve) {
    pendingResolve(result);
    pendingResolve = null;
  }

  if (result.event === 'agree') {
    pendingWaiters.forEach(({ resolve }) => resolve());
    pendingWaiters = [];
    return;
  }

  if (result.event === 'disagree') {
    pendingWaiters.forEach(({ reject }) => reject(new Error('privacy disagreed')));
    pendingWaiters = [];
  }
}

function requirePrivacyAuthorize() {
  return promptPrivacyIfNeeded();
}

module.exports = {
  initPrivacyAuthorization,
  onPrivacyNeed,
  checkPrivacyNeeded,
  promptPrivacyIfNeeded,
  resolvePrivacyAuthorization,
  requirePrivacyAuthorize
};
