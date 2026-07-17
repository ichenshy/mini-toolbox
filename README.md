# 小工具箱（pic2pdf）

微信小程序，提供两个常用工具：

- **图片转 PDF**：多图排序、旋转、合并导出，支持生成历史
- **Markdown 预览**：阅读排版 / 原文切换、代码高亮、表格展示，支持阅读历史与一键复制

## 功能概览

### 首页

冷启动进入「小工具箱」主页，选择工具进入对应页面。

### 图片转 PDF

- 从聊天选择图片（最多 32 张）
- 拖拽排序、旋转、删除
- 可选「尽量合并到同一页」、自定义边距与文件名
- 生成结果保存在本地，可在历史中打开 / 删除 / 清空

### Markdown 预览

- 聊天中通过「用其他应用打开」直接预览 `.md` 文件
- 也可在页面内选择本地 Markdown 文件
- 阅读模式与原文模式切换，原文支持复制
- 打开过的文档自动保存本地副本，可在阅读历史中再次打开
- 历史中的删除 / 清空会移除本地副本，不影响聊天原文件

## 技术说明

- 渲染：Skyline + glass-easel
- 主题：暖纸色卡片风格（`static/public.wxss`）
- PDF：基于 jsPDF 封装（`utils/my_jspdf.js`）
- Markdown：自研解析与高亮（`utils/markdown.js`、`utils/highlight.js`）

## 目录结构

```text
pages/
  home/          # 小工具箱首页
  pdf-maker/     # 图片转 PDF
  pdf-history/   # PDF 生成历史
  md-preview/    # Markdown 预览
  md-history/    # Markdown 阅读历史
utils/
  markdown.js
  highlight.js
  material.js    # 聊天素材转发
  md-history.js  # Markdown 历史存储
static/
  public.wxss    # 公共主题
```

## 开发

1. 使用微信开发者工具打开本项目
2. 填入自己的 AppID（见 `project.config.json`）
3. 编译预览

## 仓库

https://github.com/ichenshy/pic2pdf
