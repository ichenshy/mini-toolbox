const jsPDF = require('../../utils/my_jspdf.js');
const {
  prepareImageForPdf,
  buildPdfFileName,
  getPdfErrorMessage,
  inspectChatImage,
  getSupportedFormatHint
} = require('../../utils/image-pdf.js');

const formatHint = getSupportedFormatHint();

Page({
  data: {
    images: [],
    isGenerating: false,
    itemWidth: 220,
    itemHeight: 220,
    draggingIndex: -1,
    draggingTarget: -1,
    pageStyleGlobal: {},
    combineImages: false,
    margin: 10,
    customFilename: '',
    formatHintMain: formatHint.main,
    formatHintSub: formatHint.sub
  },

  onLoad() {
    this.loadPageLayoutInfo();
  },
  loadPageLayoutInfo() {
    const rect = wx.getMenuButtonBoundingClientRect()
    const windowInfo = wx.getWindowInfo();
    const pageStyleGlobal = `--status-bar-height: ${windowInfo.statusBarHeight}px;`
    this.setData({ pageStyleGlobal })
  },

  // 从聊天记录选择图片
  chooseImage() {
    wx.chooseMessageFile({
      count: 32 - this.data.images.length,
      type: 'image',
      success: async (res) => {
        const sortedFiles = res.tempFiles.sort((a, b) => a.time - b.time);
        if (!sortedFiles.length) {
          return;
        }

        wx.showLoading({
          title: '检查图片格式...',
          mask: true
        });

        const accepted = [];
        const rejected = [];

        try {
          for (const file of sortedFiles) {
            const result = await inspectChatImage(file);
            if (result.supported) {
              accepted.push({
                path: file.path,
                rotation: 0
              });
            } else {
              rejected.push({
                name: file.name || '未命名图片',
                message: result.message
              });
            }
          }
        } finally {
          wx.hideLoading();
        }

        if (accepted.length) {
          this.setData({
            images: [...this.data.images, ...accepted]
          });
        }

        if (rejected.length) {
          this.showRejectedImagesTip(rejected, accepted.length);
        } else if (!accepted.length) {
          wx.showToast({
            title: '所选图片均不支持',
            icon: 'none',
            duration: 3000
          });
        }
      },
      fail: (err) => {
        console.error('选择聊天图片失败:', err);
        let title = '无法打开聊天文件';
        if (err.errno === 112 || err.errno === 101100) {
          title = '后台需声明「收集你选中的文件」';
        } else if (err.errno === 101102) {
          title = '需先同意隐私协议';
        } else if (err.errMsg && /cancel/.test(err.errMsg)) {
          return;
        }
        wx.showToast({
          title,
          icon: 'none',
          duration: 3000
        });
      }
    });
  },

  showRejectedImagesTip(rejected, acceptedCount) {
    if (rejected.length === 1) {
      wx.showToast({
        title: rejected[0].message,
        icon: 'none',
        duration: 3000
      });
      return;
    }

    const detail = rejected.map((item) => `${item.name}: ${item.message}`).join('\n');
    const content = acceptedCount > 0
      ? `已添加 ${acceptedCount} 张。\n${detail}`
      : detail;

    wx.showModal({
      title: `${rejected.length} 张图片未添加`,
      content,
      showCancel: false
    });
  },

  // 预览图片
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      current: url,
      urls: this.data.images.map(img => img.path)
    });
  },

  // 删除图片
  deleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.images];
    images.splice(index, 1);
    
    this.setData({ images: images });
  },

  // 处理触摸开始
  onTouchStart(e) {
    const { index } = e.currentTarget.dataset;
    
    this.setData({
      draggingIndex: index
    });
  },

  // 处理触摸移动
  async onTouchMove(e) {
    if (this.data.draggingIndex === -1) return;
    
    // 从changedTouches中获取触摸坐标
    const touch = e.changedTouches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    const newIndex = await this.calculateTargetIndex(x, y);
    this.setData({ draggingTarget: newIndex });
  },

  // 处理触摸结束
  onTouchEnd(e) {

    if (this.data.draggingIndex === -1) return;
    setTimeout(() => {
      this.setData({ draggingTarget: -1, draggingIndex: -1 });
    }, 200)

    
    const { index } = e.currentTarget.dataset;
    
    // 获取松手时的位置
    const touch = e.changedTouches[0];
    const endX = touch.clientX;
    const endY = touch.clientY;
    this.updateToTarget(index, endX, endY);
  },

  calculateTargetIndex(x, y) {
    const query = wx.createSelectorQuery();
    query.selectAll('.image-item').boundingClientRect();
    
    return new Promise((resolve, reject) => {
      query.exec((res) => {
        if (!res || !res[0] || !res[0].length) {
          console.error('获取图片项位置失败');
          resolve(-1);
          return;
        }
        
        const imageRects = res[0];
        
        // 遍历所有图片项，判断是否拖拽到某一个上面了
        for (let i = 0; i < imageRects.length; i++) {
          const rect = imageRects[i];
          // 判断坐标是否在图片项范围内
          if (
            x >= rect.left && 
            x <= rect.right && 
            y >= rect.top && 
            y <= rect.bottom
          ) {
            resolve(i);
            return;
          }
        }
        resolve(-1);
      });
    });
  },
  
  updateToTarget(index, endX, endY) {

    this.calculateTargetIndex(endX, endY).then((targetIndex) => {
      if (targetIndex === -1) return;
      if (targetIndex === index) return;
      this.reorderImages(index, targetIndex);
    });

  },

  // 重新排序图片
  reorderImages(fromIndex, toIndex) {

    // 确保索引有效
    if (fromIndex < 0 || fromIndex >= this.data.images.length || 
        toIndex < 0 || toIndex >= this.data.images.length) {
        console.error('无效的索引:', { fromIndex, toIndex, totalImages: this.data.images.length });
      return;
    }
    
    const images = [...this.data.images];
    const [movedItem] = images.splice(fromIndex, 1);
    images.splice(toIndex, 0, movedItem);
    
    this.setData({ images: images, draggingTarget: -1 });
  },

  onCombineImagesChange(e) {
    this.setData({
      combineImages: e.detail.value
    });
  },

  onMarginChange(e) {
    const margin = e.detail.value === '0' ? 0 : (parseInt(e.detail.value) || 10);
    this.setData({ margin });
  },

  // 旋转图片
  rotateImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.images];
    images[index].rotation = (images[index].rotation + 90) % 360;
    this.setData({ images });
  },

  // 处理文件名变化
  onFilenameChange(e) {
    this.setData({
      customFilename: e.detail.value
    });
  },

  // 跳转到历史页面
  goToHistory() {
    wx.navigateTo({
      url: '/pages/pdf-history/pdf-history'
    });
  },

  goHome() {
    wx.navigateBack({
      fail: () => {
        wx.reLaunch({
          url: '/pages/home/home'
        });
      }
    });
  },

  // 生成PDF
  async generatePDF() {
    if (this.data.images.length === 0) {
      wx.showToast({
        title: '请先选择图片',
        icon: 'none'
      });
      return;
    }

    if (this.data.isGenerating) {
      return;
    }

    this.setData({ isGenerating: true });
    wx.showLoading({
      title: '正在生成PDF...',
    });

    let currentImageIndex = 0;

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = this.data.margin;
      let currentY = margin;
      const maxContentWidth = pageWidth - 2 * margin;
      const maxContentHeight = pageHeight - 2 * margin;

      for (let i = 0; i < this.data.images.length; i++) {
        currentImageIndex = i;
        const rotation = this.data.images[i].rotation;
        let prepared;

        try {
          prepared = await prepareImageForPdf(this.data.images[i].path);
        } catch (err) {
          err.stage = err.stage || 'imageInfo';
          throw err;
        }

        let width = prepared.width;
        let height = prepared.height;

        if (rotation === 90 || rotation === 270) {
          [width, height] = [height, width];
        }

        const scale = Math.min(
          maxContentWidth / width,
          maxContentHeight / height
        );
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;

        if (!this.data.combineImages) {
          if (i > 0) {
            doc.addPage();
          }
          currentY = margin;
        } else if (currentY + scaledHeight > maxContentHeight + 1) {
          doc.addPage();
          currentY = margin;
        }

        const x = (pageWidth - scaledWidth) / 2;
        const y = this.data.combineImages ? currentY : (pageHeight - scaledHeight) / 2;
        const adjustedX = Math.max(margin, x);
        const adjustedY = Math.max(margin, y);
        const adjustedWidth = Math.min(scaledWidth, maxContentWidth);
        const adjustedHeight = Math.min(scaledHeight, maxContentHeight);
        const uint8Array = new Uint8Array(prepared.data);
        const format = prepared.format;

        try {
          if (rotation === 90) {
            doc.addImage(uint8Array, format, adjustedX + adjustedWidth, adjustedY + (adjustedHeight - adjustedWidth), adjustedHeight, adjustedWidth, '', 'NONE', 90);
          } else if (rotation === 180) {
            doc.addImage(uint8Array, format, adjustedX + adjustedWidth, adjustedY - adjustedHeight, adjustedWidth, adjustedHeight, '', 'NONE', 180);
          } else if (rotation === 270) {
            doc.addImage(uint8Array, format, adjustedX, adjustedY - adjustedWidth, adjustedHeight, adjustedWidth, '', 'NONE', 270);
          } else {
            doc.addImage(uint8Array, format, adjustedX, adjustedY, adjustedWidth, adjustedHeight, '', 'NONE', 0);
          }
        } catch (err) {
          err.stage = 'addImage';
          throw err;
        }

        if (this.data.combineImages) {
          currentY += adjustedHeight + margin;
        }
      }

      const pdfData = doc.output('arraybuffer');
      const base64 = wx.arrayBufferToBase64(pdfData);
      const fileName = buildPdfFileName(this.data.customFilename);
      const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;

      try {
        await new Promise((resolve, reject) => {
          wx.getFileSystemManager().writeFile({
            filePath,
            data: base64,
            encoding: 'base64',
            success: resolve,
            fail: reject
          });
        });
      } catch (err) {
        err.stage = 'save';
        throw err;
      }

      wx.hideLoading();

      wx.openDocument({
        filePath,
        fileType: 'pdf',
        showMenu: true,
        success: () => {
          wx.showToast({
            title: 'PDF生成成功',
            icon: 'success'
          });
        },
        fail: (err) => {
          console.error('打开PDF文件失败:', err);
          wx.showModal({
            title: 'PDF 已生成',
            content: '文件已保存，可在历史记录中打开',
            confirmText: '查看历史',
            cancelText: '知道了',
            success: (res) => {
              if (res.confirm) {
                this.goToHistory();
              }
            }
          });
        }
      });
    } catch (error) {
      console.error('生成PDF失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: getPdfErrorMessage(error, currentImageIndex),
        icon: 'none',
        duration: 3000
      });
    } finally {
      this.setData({ isGenerating: false });
    }
  }
}); 