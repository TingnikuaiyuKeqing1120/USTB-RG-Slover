# USTB RG Helper Enhanced

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

北京科技大学锐格实验平台（`ucb.ustb.edu.cn`）辅助工具 Tampermonkey 脚本。

> 基于原作者 [Harry Huang](https://github.com/isHarryh) 的 [USTB-Awesome-JS](https://github.com/isHarryh/USTB-Awesome-JS) 增强开发。

## 功能

- **一键答题** — 自动获取答案、填入表单、提交
- **批量答题** — 遍历当前章节所有未完成题目
- **全局答题** — 展开所有章节，跨节自动切换，一次性清理所有未做题目
- **强制显示答案** — 查看参考答案，支持一键复制
- **强制提交** — 绕过截止时间限制补交
- **解除复制限制** — 允许右键和文本选择
- **人工处理队列** — 遇到错误或者异常自动捕捉，并在左下角浮动面板显示需手动处理的题目
- 支持选择题、填空题、编程题

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)#脚本猫也可以
2. 下载并导入 `USTB-RG-Helper.user.js`#也可以打开之后直接复制
3. 打开锐格平台即生效#如果不行，刷新一下页面即可

## 文件说明

| 文件 | 说明 |
|------|------|
| `USTB-RG-Helper.user.js` | Tampermonkey 用户脚本 |
| `DEVELOPMENT_LOG.md` | 开发记录、问题与解决方案 |
| `USAGE.md` | 使用说明 |

## 致谢

- [Harry Huang](https://github.com/isHarryh) — 原版 [USTB-Awesome-JS](https://github.com/isHarryh/USTB-Awesome-JS) 作者，提供了 XHRSpy 劫持、基本 UI、强制提交/显示答案的基础框架
- Deepseek V4 Pro & Opencode - 帮我完成了新功能的开发
