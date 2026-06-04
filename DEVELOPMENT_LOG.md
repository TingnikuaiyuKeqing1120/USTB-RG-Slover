# USTB RG Helper — 开发记录

## 一、项目概述

为北京科技大学锐格实验平台（`ucb.ustb.edu.cn`）开发的一键答题/批量答题 Tampermonkey 用户脚本。基于原版 [USTB-Awesome-JS](https://github.com/isHarryh/USTB-Awesome-JS) 扩展，新增全局批量自动答题、失败题人工队列等功能。

## 二、关键经验教训

### 1. 理解平台结构，而非盲目猜测

**问题**：最初不清楚答案 HTML 的格式，写了很多猜测性的解析逻辑。

**解决**：直接让用户在控制台运行拦截脚本，捕获 popup 接口的原始 HTML，发现答案格式统一为 `X、正确.`（选择题/判断题）或纯文本（填空题）或 `init_obj.content`（编程题）。

**思维**：遇到未知数据结构时，最快的路径是**直接获取原始数据**（Network 拦截、console.log），而非猜测和试错。

### 2. HTML 实体编码陷阱

**问题**：ACE 编辑器中编程题的代码显示为 `&quot;`、`&lt;` 等 HTML 实体，导致编译错误。

**根因**：服务器返回的答案内容经过 HTML 实体编码。"强制显示答案" 用 `.html()` 写入 DOM 时浏览器自动解码，但 `ace.setValue()` 是纯文本写入，实体未被解码。

**解决**：
```javascript
const temp = document.createElement('textarea');
temp.innerHTML = code;
code = temp.value;  // 浏览器自动解码 HTML 实体
```

**思维**：处理来自服务端的文本时，始终考虑**编码/解码层次**——JSON 转义、HTML 实体、URL 编码是不同层的问题，需要分别在对应层解码。

### 3. ACE 编辑器不能直接用 .val() 设值

**问题**：填空题也用了 ACE 编辑器，`.val()` 写入不触发 ACE 内部文档更新，提交时报"请填写后再提交"。

**解决**：检测 ACE 存在时优先用 `ace.edit(el).setValue(text, -1)`。

**思维**：Web 富文本编辑器（ACE、CodeMirror、Monaco 等）有自己的内部文档模型，操作 DOM 原生 textarea 不会同步。需要调用编辑器 API。

### 4. Tampermonkey 沙盒模式与 unsafewindow

**问题**：脚本始终无法通过 zTree 切换章节，`window.ztree` 返回 `undefined`。

**根因**：脚本使用 `@grant GM_addStyle`，进入 Tampermonkey 沙盒模式。沙盒中的 `window` 是被包装的对象，不包含页面全局变量。

**解决**：添加 `@grant unsafeWindow`，所有页面全局访问改为 `unsafeWindow.xxx`。

**思维**：Tampermonkey 脚本有两种运行模式：
- **无 @grant**：直接在页面上下文运行，可访问所有页面变量，但不能使用 GM_* API
- **有 @grant**：在沙盒运行，必须通过 `unsafeWindow` 访问页面变量

关键判断：如果一个页面全局变量始终是 `undefined`，首先检查是否处于沙盒模式。

### 5. zTree 节点类型与导航

**问题**：点击"节"（section）节点不会加载题目，必须点击"题"（exercise）节点，导致章节切换失败。

**发现**：zTree 四层结构：
```
教学方案 (solution) → 章 (chapter) → 节 (section) → 题 (exercise)
```
平台只在 exercise 节点的 onClick 中触发 `ajaxLoad`。section 节点的 onClick 只触发展开/折叠。

**解决**：`_navigateToSection` 展开节节点后，点击其 `zNode.children[0]`（第一个 exercise 子节点）的 `<a>` 元素。

**思维**：操作第三方组件（zTree、ACE 等）时，需要理解其**内部事件模型**。不同节点类型的点击行为可能完全不同，需要直接测试验证。

### 6. 原生 alert() 阻塞 JS 执行

**问题**：章节末题点"下一题"弹窗 `alert("当前章节已经没有下一题")`，导致所有 setTimeout 回调暂停。

**发现**：以为弹窗是 SimpleModal（页面引用了 `jquery.simplemodal.js`），实际是原生 `window.alert()`。通过 `chrome-devtools_take_snapshot` 看到 `# Open dialog: alert` 才确认。

**解决**：批量模式下直接覆盖 `unsafeWindow.alert = function() {}` 静默吞掉。

**思维**：Web 弹窗有多种实现方式（原生 alert/confirm、Bootstrap Modal、SimpleModal、自定义 div），不要假设。用 DevTools snapshot 或 `handle_dialog` 可以准确判断类型。

### 7. 异步时序问题

**问题**：`_expandTreeNodes()` 触发异步 `ajaxGetNodes` 加载节节点，但立即遍历 zTree 时节点尚未加载，导致找不到下一节。

**解决**：先调 `_expandTreeNodes()`，然后等 5 秒再执行 `_doNextSection()` 收集节点。

**思维**：链式异步操作中，如果某一步无回调可用，**固定等待时间 + 重试**是实用的 fallback 方案。比无限递归/死循环安全。

### 8. 状态管理——避免死循环

**问题**：
- 空节（如"扩展习题"无题目）跳过时不更新当前节 ID → 永远跳过同一节 → 死循环
- 失败题目没有标记 → doStep 重复尝试 → 死循环
- 末题完成后再点"下一题"回到同题 → 章节末尾循环

**解决**：
- 引入 `currentSectionId` 独立跟踪当前节，`_navigateToSection` 入口即更新
- 引入 `failedIds` Set 标记失败题，doStep 自动跳过
- 引入 `lastCompletedId` 检测连续两次遇到同一已完成题目 → 触发章节切换或停止

**思维**：自动化流程中，**幂等性**和**状态标记**至关重要。每个步骤执行后必须有可见的状态变更（更新 ID、添加到 Set、设 flag），否则下一步无法区分"刚完成"和"之前已完成"。

### 9. 选择器/正则的精确性

**问题**：最初用 `treeNode.myscore === '1'` 判断题目是否已完成，但 `myscore` 是题目满分（始终为 1），不是用户得分 → 所有题目都被误判为已答。

**解决**：改用 `correctSign`（是否正确作答）配合页面 `#my_score` 文本和 `#feedbackBox` 是否显示"回答正确"三重判断。

**思维**：服务端返回的同名字段可能有不同语义。需要交叉验证（页面 DOM + 接口响应）确保判断准确。

### 10. 可见反馈 > 控制台日志

**问题**：失败题目只在 console.log 记录，批量答题时用户注意不到。

**解决**：新增 `ManualQueue` 浮动面板，固定在页面左下角，实时显示需人工处理的题目编号和原因。

**思维**：长时间运行的自动化工具必须有**持久化、可见化**的异常记录机制。控制台日志易被新日志冲掉，DOM 面板更直观。

## 三、调试方法论

### 3.1 高效的信息获取

| 场景 | 方法 |
|------|------|
| 未知接口返回格式 | 在 Network 面板复制 Response，或运行拦截脚本 console.log |
| 页面元素结构 | `$('#xxx').find('input,textarea').map(...)` 导出选择器列表 |
| zTree 节点树 | `ztree.getNodes()` 递归遍历，输出 name/type/isParent/open/children |
| 弹窗类型 | chrome-devtools `take_snapshot` 查看是否出现 `# Open dialog` |
| 沙盒模式 | 直接 console 测试 `typeof ztree` vs 脚本内 `typeof window.ztree` |

### 3.2 Chrome DevTools 远程调试

通过 MCP 工具可以远程操控浏览器：执行 JS、点击元素、查看 DOM 快照、处理弹窗。这使得调试无需频繁让用户手动操作。

## 四、脚本架构决策

| 决策 | 理由 |
|------|------|
| IIFE + 静态类 | 所有类（BatchAnswer、OneClickAnswer 等）在 IIFE 内，避免污染全局 |
| XHRSpy 拦截 | 劫持 `XMLHttpRequest.prototype.send`，无需修改平台代码即可响应数据变化 |
| 回调式异步 | `OneClickAnswer.execute(onComplete)` 支持链式调用，确保批量和单次复用同一逻辑 |
| `_setTimer` 封装 | 全局单 timer 管理，避免多个 setTimeout 互相竞争 |

## 五、后续改进方向

1. **代码拼接题自动提取**：从完整答案中识别 `//start`/`//end` 区间，只填入中间部分
2. **跨教学方案切换**：处理"课后作业"和"上机实验"两个方案之间的自动切换
3. **答案缓存**：已获取的答案避免重复请求 popup 接口
4. **断点续传**：记录已处理到的位置，页面刷新后可以继续
