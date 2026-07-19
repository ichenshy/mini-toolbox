const ENV_LABEL = {
  develop: '开发版',
  trial: '体验版',
  release: ''
};

function getMiniProgramVersionLabel() {
  try {
    const { miniProgram } = wx.getAccountInfoSync();
    const version = miniProgram.version || '';
    const envLabel = ENV_LABEL[miniProgram.envVersion] || '';

    if (version) {
      return envLabel ? `v${version} ${envLabel}` : `v${version}`;
    }

    return envLabel || '开发版';
  } catch (err) {
    return '';
  }
}

module.exports = {
  getMiniProgramVersionLabel
};
