const { readFileCompat } = require('./read-file.js');

const DIRECT_IMAGE_TYPES = new Set(['jpeg', 'jpg', 'png']);
const CONVERTIBLE_IMAGE_TYPES = new Set(['heic', 'heif', 'webp']);
const UNSUPPORTED_IMAGE_TYPES = new Set(['gif', 'bmp', 'svg', 'tiff', 'tif', 'ico', 'raw']);

function detectPdfImageFormat(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return 'JPEG';
  }
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'PNG';
  }
  return null;
}

function getImageInfo(src) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src,
      success: resolve,
      fail: reject
    });
  });
}

function extractExtension(fileName) {
  const match = (fileName || '').match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : '';
}

function normalizeImageType(type, fileName) {
  const ext = extractExtension(fileName);
  const raw = (type || ext || '').toLowerCase().replace(/^image\//, '');

  if (raw === 'jpeg' || ext === 'jpg' || ext === 'jpeg') {
    return 'jpeg';
  }
  if (raw === 'png' || ext === 'png') {
    return 'png';
  }
  if (raw === 'heic' || raw === 'heif' || ext === 'heic' || ext === 'heif') {
    return 'heic';
  }
  if (raw === 'webp' || ext === 'webp') {
    return 'webp';
  }
  if (raw === 'gif' || ext === 'gif') {
    return 'gif';
  }
  if (raw === 'bmp' || ext === 'bmp') {
    return 'bmp';
  }
  if (raw === 'svg' || ext === 'svg' || ext === 'svgz') {
    return 'svg';
  }
  if (raw === 'tiff' || raw === 'tif' || ext === 'tiff' || ext === 'tif') {
    return 'tiff';
  }

  return raw || ext;
}

function getFormatLabel(format) {
  if (!format) {
    return '未知';
  }
  if (format === 'jpeg') {
    return 'JPG';
  }
  return format.toUpperCase();
}

function getSupportedFormatHint() {
  return {
    main: '支持 JPG、PNG；HEIC/WebP 将自动转换',
    sub: '不支持 GIF、BMP、TIFF、SVG 等格式'
  };
}

async function canConvertToPdfImage(imagePath) {
  const compressedPath = await compressImage(imagePath);
  const data = await readFileCompat(compressedPath);
  return !!detectPdfImageFormat(data);
}

/**
 * 检查从聊天选择的图片是否可用于生成 PDF。
 */
async function inspectChatImage(file) {
  const fileName = file.name || '';
  let info;

  try {
    info = await getImageInfo(file.path);
  } catch (err) {
    return {
      supported: false,
      format: '',
      message: '无法读取该图片'
    };
  }

  const format = normalizeImageType(info.type, fileName);
  const formatLabel = getFormatLabel(format);

  if (DIRECT_IMAGE_TYPES.has(format)) {
    return {
      supported: true,
      format,
      mode: 'direct',
      message: ''
    };
  }

  if (UNSUPPORTED_IMAGE_TYPES.has(format)) {
    return {
      supported: false,
      format,
      message: `不支持 ${formatLabel} 格式`
    };
  }

  if (CONVERTIBLE_IMAGE_TYPES.has(format)) {
    try {
      const convertible = await canConvertToPdfImage(file.path);
      if (convertible) {
        return {
          supported: true,
          format,
          mode: 'convert',
          message: ''
        };
      }
    } catch (err) {
      console.warn('图片格式转换预检失败:', err);
    }

    return {
      supported: false,
      format,
      message: `${formatLabel} 暂不支持，请换 JPG/PNG`
    };
  }

  try {
    const data = await readFileCompat(file.path);
    if (detectPdfImageFormat(data)) {
      return {
        supported: true,
        format,
        mode: 'direct',
        message: ''
      };
    }

    const convertible = await canConvertToPdfImage(file.path);
    if (convertible) {
      return {
        supported: true,
        format,
        mode: 'convert',
        message: ''
      };
    }
  } catch (err) {
    console.warn('未知图片格式预检失败:', err);
  }

  return {
    supported: false,
    format,
    message: `不支持 ${formatLabel} 格式`
  };
}

function compressImage(src) {
  return new Promise((resolve, reject) => {
    wx.compressImage({
      src,
      quality: 90,
      success: (res) => resolve(res.tempFilePath),
      fail: reject
    });
  });
}

/**
 * 将聊天图片规范为 jsPDF 可嵌入的 JPEG/PNG。
 * HEIC、WebP 等格式会先尝试 compressImage 转成 JPG。
 */
async function prepareImageForPdf(imagePath) {
  const info = await getImageInfo(imagePath);
  let data = await readFileCompat(imagePath);
  let format = detectPdfImageFormat(data);

  if (format) {
    return {
      data,
      format,
      width: info.width,
      height: info.height,
      type: info.type || format.toLowerCase()
    };
  }

  const compressedPath = await compressImage(imagePath);
  data = await readFileCompat(compressedPath);
  format = detectPdfImageFormat(data);

  if (!format) {
    const error = new Error('unsupported image format');
    error.stage = 'format';
    error.type = info.type || 'unknown';
    throw error;
  }

  return {
    data,
    format,
    width: info.width,
    height: info.height,
    type: info.type || format.toLowerCase()
  };
}

function sanitizePdfFileName(name) {
  return (name || '').trim().replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}

function buildPdfFileName(customFilename) {
  const sanitized = sanitizePdfFileName(customFilename);
  if (sanitized) {
    return `${sanitized}.pdf`;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}.pdf`;
}

function getPdfErrorMessage(error, imageIndex) {
  if (error && error.stage === 'format') {
    const label = getFormatLabel(error.type);
    return `第${imageIndex + 1}张图片(${label})不支持`;
  }
  if (error && error.stage === 'imageInfo') {
    return `第${imageIndex + 1}张图片读取失败`;
  }
  if (error && error.stage === 'addImage') {
    return `第${imageIndex + 1}张图片写入失败`;
  }
  if (error && error.stage === 'save') {
    return '保存 PDF 失败，存储空间可能不足';
  }
  if (error && error.errMsg && /writeFile/.test(error.errMsg)) {
    return '保存 PDF 失败，存储空间可能不足';
  }
  return '生成 PDF 失败，请重试';
}

module.exports = {
  detectPdfImageFormat,
  prepareImageForPdf,
  inspectChatImage,
  getSupportedFormatHint,
  sanitizePdfFileName,
  buildPdfFileName,
  getPdfErrorMessage
};
