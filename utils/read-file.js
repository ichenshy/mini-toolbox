/**
 * 兼容读取本地临时文件。
 * 真机多为 wxfile:// 等本地路径，走 FileSystemManager.readFile；
 * 开发者工具常见 http://tmp/... 无法被 readFile 读取，改用 request 兜底。
 *
 * @param {string} filePath
 * @param {{ encoding?: string }} [options] 传入 encoding（如 utf8）返回字符串，否则返回 ArrayBuffer
 * @returns {Promise<string|ArrayBuffer>}
 */
function readFileCompat(filePath, options = {}) {
  const encoding = options.encoding;

  return new Promise((resolve, reject) => {
    const params = {
      filePath,
      success: (res) => resolve(res.data),
      fail: (err) => {
        if (!/^https?:\/\//i.test(filePath)) {
          reject(err);
          return;
        }

        const wantText = encoding === 'utf8' || encoding === 'utf-8';
        wx.request({
          url: filePath,
          responseType: wantText ? 'text' : 'arraybuffer',
          success: (res) => {
            if (res.statusCode >= 200 && res.statusCode < 300 && res.data != null) {
              resolve(res.data);
              return;
            }
            reject(err);
          },
          fail: (requestErr) => reject(requestErr || err)
        });
      }
    };

    if (encoding) {
      params.encoding = encoding;
    }

    wx.getFileSystemManager().readFile(params);
  });
}

module.exports = {
  readFileCompat
};
