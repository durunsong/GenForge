<img src="src/renderer/assets/icon.png" width="64" height="64" alt="GenForge">

# GenForge

**语言 / Language:** [中文](README.md) | [English](README.en.md)

多模型 AI 生图工作台，基于 Gemini / GPT Image（TypeScript + Electron）。

作者与维护者：[durunsong](https://github.com/durunsong)。

支持 **Windows / macOS / Linux**，可并发生图、2K/4K 渲染，对话与图片本地存储。

[![Release](https://img.shields.io/github/v/release/durunsong/GenForge?label=Release)](https://github.com/durunsong/GenForge/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)](https://github.com/durunsong/GenForge/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](LICENSE)

---

## 目录

- [功能亮点](#功能亮点)
- [下载安装](#下载安装)
- [快速开始（开发）](#快速开始开发)
- [使用指南](#使用指南)
- [配置 API](#配置-api)
- [自动更新](#自动更新)
- [发版说明](#发版说明)
- [目录结构](#目录结构)
- [Scripts](#scripts)
- [常见问题](#常见问题)
- [许可证](#许可证)

---

## 功能亮点

| 能力 | 说明 |
|------|------|
| 多模型生图 | 支持 Gemini 图像模型、GPT Image 等，通过 OpenAI 兼容或 Gemini 原生接口接入 |
| 多渠道管理 | 可配置多个 API 渠道，支持随机优选自动轮询 |
| 分辨率与比例 | 1K / 2K / 4K，以及 Auto、21:9、16:9、1:1、9:16 等多种长宽比 |
| 参考图上传 | 上传参考图进行图生图 / 编辑 |
| 生成数量 | 每次可选 1–4 张并记住选择；Images API 原生批量生成，Gemini / Chat 逐张生成，成功结果保留在对话中 |
| 对话上下文 | 可选保留最近 N 轮对话，便于连续创作 |
| 本地自动保存 | 生成图片可自动写入本地目录 |
| 暗黑模式 | 设置页一键切换主题 |
| 自动更新 | Windows 安装版、macOS、Linux AppImage 支持检查更新 |

### 创作工具

| 工具 | 说明 |
|------|------|
| **XHS 灵感实验室** | 小红书风格文案与配图灵感创作 |
| **提示词快查** | 浏览、搜索、复制优质提示词 |
| **我的提示词** | 管理个人提示词库，一键填入输入框 |
| **制作表情包** | 快速进入表情包生成模式 |
| **图片切片** | 九宫格切图工具 |

---

## 下载安装

1. 打开 [最新版本下载](https://github.com/durunsong/GenForge/releases/latest)（[全部版本](https://github.com/durunsong/GenForge/releases)）
2. 按系统下载对应安装包：

| 系统 | 推荐下载 | 说明 |
|------|----------|------|
| Windows | `GenForge-*-win-x64.exe` | NSIS 安装版，可自动更新 |
| Windows | `GenForge-*-portable.exe` | 便携版，需手动下载新版本 |
| Windows | `GenForge-*-win-x64.zip` | 解压后运行，需手动升级 |
| macOS | `GenForge-*-mac-universal.dmg` | Intel + Apple Silicon 通用包 |
| Linux | `GenForge-*-linux-x86_64.AppImage` | 推荐，可自动更新 |
| Linux | `GenForge-*-linux-amd64.deb` | Debian / Ubuntu 安装包 |

3. 安装后打开即可使用

普通用户无需安装 Node.js 或下载源码。Release 正文会提供按系统分类的直接下载链接；下方 **Assets** 也包含相同安装包。`Source code (zip/tar.gz)` 是 GitHub 自动生成的源码压缩包，不是安装包。首次发布完成前，最新版本链接可能显示 404。

每次发布还提供 `SHA256SUMS.txt`，可用 Windows `Get-FileHash`、macOS `shasum -a 256` 或 Linux `sha256sum` 校验下载文件。`latest*.yml` 和 `.blockmap` 是应用更新资源，无需手动安装。

### macOS 首次打开

当前发版默认为未公证签名。若提示「无法打开」，请：

1. 右键 App → **打开**
2. 或在终端执行：

```bash
xattr -cr /Applications/GenForge.app
```

### Linux AppImage

```bash
chmod +x GenForge-*-linux-x86_64.AppImage
./GenForge-*-linux-x86_64.AppImage
```

---

## 快速开始（开发）

环境要求：Node.js 20+

```bash
git clone https://github.com/durunsong/GenForge.git
cd GenForge
npm install
npm run dev
```

仅编译不启动：

```bash
npm run build
npm start
```

---

## 使用指南

1. 打开应用，进入 **设置 → API 渠道管理**
2. 新增渠道：填写名称、接口类型、Base URL、API Key、模型
3. 在主界面输入画面描述，可按需上传参考图
4. 在设置中选择分辨率与长宽比后发送
5. 左侧可新建对话、管理会话，或使用创作工具

提示词可从「提示词快查」复制，或保存到「我的提示词」后一键填入。

---

## 配置 API

设置 → **API 渠道管理**：

| 接口类型 | 适用场景 |
|----------|----------|
| Gemini 原生接口 | 直连 Gemini |
| OpenAI 兼容 · Chat Completions | 多数 Gemini 图像代理、兼容旧逻辑 |
| OpenAI 兼容 · Images API | `gpt-image-*` 等，走 `/v1/images/generations` / `edits` |

### 配置要点

- **Base URL** 填写域名根路径，不要带 `/v1`（例如 `https://api.example.com`）
- 预设模型可选：`gpt-image-2`、`gpt-image-1.5`、`gemini-2.5-flash-image`、`gemini-3-pro-image-preview`，也可自定义
- 选择 **Images API** 后：无参考图走 `/v1/images/generations`，有参考图走 `/v1/images/edits`
- 可添加多个渠道，并选择「随机优选」自动轮询

API Key 仅保存在本机，不会上传到本项目服务器。

---

## 自动更新

| 包类型 | 自动更新 |
|--------|----------|
| Windows NSIS 安装版 | ✅ |
| Windows 便携版 | ❌ 请用安装版，或手动下载 Releases |
| macOS（dmg + zip） | 需要代码签名；当前未签名版本请手动升级 |
| Linux AppImage | ✅ |
| Linux deb | 建议手动升级 |

设置页可手动点击「检查更新」。有新版本时会弹窗提示，确认后下载并重启。

---

## 发版说明

### 推荐：打 tag 触发三端自动打包

工作流位于 `.github/workflows/release.yml`。上传源码本身不会生成安装包；推送 `vX.Y.Z` 标签才会触发正式发布。当前流程只发布稳定版本，标签必须与 `package.json`、`package-lock.json` 的版本一致。

1. 后续升级先执行 `npm version patch --no-git-tag-version`，同步更新两个版本文件；首次发布可直接使用当前 `1.0.3`。
2. 检查并提交本次发布涉及的文件，再打 tag（下面以首次发布为例）：

```bash
# 先检查 git diff，并单独提交本次发布文件
git tag v1.0.3
git push origin v1.0.3
```

3. 在仓库 **Actions → Release** 查看进度：先验证版本，再并行生成 Windows EXE / 便携版 / ZIP、macOS 通用 DMG / ZIP、Linux AppImage / DEB。
4. 三端全部成功后，检查安装包、更新元数据及哈希，生成下载表格、安装说明、SHA-256 校验文件和 GitHub 更新记录。全部资源上传至草稿成功后，才公开 Release。
5. Windows 安装版与 Linux AppImage 可使用应用内更新；macOS 当前未签名版本请从 Release 手动升级。

任一平台失败不会发布不完整版本；上传失败保留草稿，可在 Actions 重跑。已公开的同名版本不会被覆盖，请提升版本号。GitHub Actions 使用内置 `GITHUB_TOKEN`，无需添加个人令牌；仓库须启用 Actions 并允许工作流写入 Releases。

### 先试打包，不公开发布

提交并推送工作流后，进入 **Actions → Release → Run workflow**，选择分支，保持 `publish` 为 `false`。成功后在运行页面的 **Artifacts** 下载 `genforge-platform-win/mac/linux` 或汇总包 `genforge-release`（保留 14 天，通常需要登录 GitHub）。汇总包中的发布说明用于预览，正式下载链接在公开 Release 后生效。

手动正式发布时必须选择已存在且包含这套工作流的 `vX.Y.Z` 标签，并勾选 `publish`；不允许从分支发布。自动更新依赖的 `latest*.yml`、ZIP 和 `.blockmap` 会随安装包一同上传，请勿删除。

发布检查：`npm run test:release`；只检查版本：`node scripts/prepare-release.cjs v1.0.3`。

### 本地打包（不发布）

```bash
npm run dist          # 当前系统
npm run dist:win      # 仅 Windows（需在 Windows 或对应 CI）
npm run dist:mac      # 仅 macOS（需在 macOS）
npm run dist:linux    # 仅 Linux（需在 Linux）
```

### 本地发布到 GitHub Releases

```bash
npm run release       # 当前系统
# 或
npm run release:win
npm run release:mac
npm run release:linux
```

本地发布需要显式提供 `GH_TOKEN`，仅登录 `gh` 不会自动传给 electron-builder。本地发布命令只上传当前平台，绕过三端完整性检查；正式完整发版推荐使用上面的标签 + Actions 流程。

---

## 目录结构

```
src/main/           Electron 主进程、自动更新
src/renderer/       界面与业务逻辑
scripts/            构建与图标生成脚本
assets/brand/       GenForge 可编辑图标源文件
build/              自动生成的应用图标等打包资源
.github/workflows/  三端自动发版工作流
```

---

## Scripts

| 命令 | 说明 |
|------|------|
| `npm run dev` | 编译并启动开发 |
| `npm run build` | 编译主进程与渲染进程、生成图标 |
| `npm start` | 启动已编译应用 |
| `npm run dist` | 当前系统打包（不发布） |
| `npm run dist:win` / `dist:mac` / `dist:linux` | 指定系统打包 |
| `npm run dist:portable` | 仅打包 Windows 便携版 |
| `npm run release` | 当前系统打包并发布到 GitHub Releases |

---

## 常见问题

**Q: 升级后原来的对话和配置还在吗？**

GenForge 会优先使用现有的 GenForge 数据目录；如果没有，会沿用旧版数据目录。新安装使用 GenForge 目录。旧的浏览器存储标识保留兼容，不移动、合并或删除历史数据。

**Q: 生图失败 / 401？**  
检查 API Key、Base URL 是否正确，以及模型名是否与渠道匹配。Base URL 不要末尾带 `/v1`。

**Q: macOS 提示无法打开？**  
见上文 [macOS 首次打开](#macos-首次打开)。

**Q: 便携版没有更新提示？**  
便携版不支持自动更新，请到 [Releases](https://github.com/durunsong/GenForge/releases) 手动下载。

**Q: 自动保存目录选不了？**  
该能力依赖 File System Access API，建议使用较新的 Chromium 内核环境；桌面端一般可用设置页中的保存目录选择。

---

## 许可证

[Apache-2.0](LICENSE)

---

**语言 / Language:** [中文](README.md) | [English](README.en.md)
