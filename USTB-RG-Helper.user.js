// ==UserScript==
// @name         USTB RG Helper Enhanced
// @version      1.2
// @description  北京科技大学锐格实验平台辅助工具 — 一键答题/批量答题/全局答题/强制提交/显示答案/解除复制限制|基于 USTB RG Helper 修改，原作者 Harry Huang,https://github.com/isHarryh/USTB-Awesome-JS
// @author       TingnikuaiyuKeqing-L & deepseekV4Pro in opencode(I like this whale.)
// @license      MIT
// @match        *://ucb.ustb.edu.cn/*
// @run-at       document-body
// @grant        unsafeWindow
// @grant        GM_addStyle
// @require      https://cdn.jsdelivr.net/npm/jquery@3.5.1/dist/jquery.min.js
// @source       
// @namespace    http://ucb.ustb.edu.cn/
// ==/UserScript==

(function() {
    'use strict';

    // Optimize webpage style
    GM_addStyle(`
        /* USTH RG Helper */
        /* Header */
        .c_pic img {
            width: unset !important;
        }
        .container_header {
            height: 50px !important;
        }
        .logo {
            padding-top: 0 !important;
        }
        .nav {
            left: 250px !important;
            top: 5px !important;
        }
        .nav li a {
            height: 35px !important;
            padding-top: 10px !important;
        }
        /* Footer */
        #outter {
            padding: 0 !important;
        }
        .buttom {
            height: auto !important;
            padding: 10px 0 !important;
            position: unset !important;
        }
        .buttom pre {
            text-wrap: balance;
            word-break: break-word;
        }
        /* Content */
        pre {
            background: #fff6 !important;
            font-family: consolas, monaco !important;
            margin: 5px 0 !important;
            padding: 10px !important;
        }
        .article, .article1, .article2, .article3 {
            border-radius: 10px !important;
            margin: 5px 0 !important;
            padding: 10px !important;
        }
        #exercise_submit {
            display: grid !important;
        }
        .zTreeDemoBackground {
            width: inherit !important;
            height: 75vh !important;
        }
        .ztree {
            width: inherit !important;
            height: inherit !important;
        }
        .exercise_date {
            color: #888;
            padding: 5px 0;
        }
        #rghRelTime {
            color: #44c;
            padding: 0 5px;
        }
        .rg-log {
            color: #fff;
            margin: 5px;
            text-align: center;
        }
        .rg-log-info {
            color: #eee;
        }
        .rg-log-warn {
            color: #dd0;
        }
        .rg-log-error {
            color: #c00;
        }
        .btn {
            transition: translate 0.2s !important;
        }
        .btn:hover {
            translate: 0 -2.5px !important;
        }
        .mgt15, .mgt20, .mgt30 {
            margin-top: 12.5px !important;
        }
        #rghOneClickAnswer {
            background: #e85d04 !important;
            color: #fff !important;
        }
    `);

    // Enable text selecting
    $(document).ready(() => {
        $('body').append(`
            <script type="text/javascript" name="ustb-rg-helper">
                $('body').unbind('contextmenu');
                $(document).unbind('selectstart');
                console.log("USTB RG Helper ready");
            </script>
        `);
    });

    class DateTimeHelper {
        static toRelTime(dateString) {
            const SECOND = 1,
                  MINUTE = 60 * SECOND,
                  HOUR = 60 * MINUTE,
                  DAY = 24 * HOUR,
                  WEEK = 7 * DAY,
                  LONG_TIME = 10 * WEEK;

            const diffSec = Math.round((new Date(`${dateString} 23:59:59`) - new Date()) / 1000);
            const diffSecAbs = Math.abs(diffSec);
            const isLater = diffSec > 0;
            const suffix = isLater ? '后' : '前';

            if (diffSecAbs < MINUTE) {
                return isLater ? '刚刚' : "现在";
            } else if (diffSecAbs < HOUR) {
                const m = Math.floor(diffSecAbs / MINUTE);
                return `${m}分${suffix}`;
            } else if (diffSecAbs < DAY) {
                const h = Math.floor(diffSecAbs / HOUR);
                const m = Math.floor((diffSecAbs % HOUR) / MINUTE);
                return `${h}小时${m > 0 ? m + '分' : ''}${suffix}`;
            } else if (diffSecAbs < WEEK) {
                const d = Math.floor(diffSecAbs / DAY);
                const h = Math.floor((diffSecAbs % DAY) / HOUR);
                return `${d}天${h > 0 ? h + '小时' : ''}${suffix}`;
            } else if (diffSecAbs < LONG_TIME) {
                const w = Math.floor(diffSecAbs / WEEK);
                const d = Math.floor((diffSecAbs % WEEK) / DAY);
                return `${w}周${d > 0 ? d + '天' : ''}${suffix}`;
            } else {
                return `很久以${suffix}`;
            }
        }

        static showRelTimeOnArticle() {
            const title = $('#nodeTitle');
            const display = $('#done_time').find('.exercise_date');
            const displayInner = $('#rghRelTime');
            if (title !== null && display !== null) {
                const nodeData = QuestionTree.getNodeFromName(title.text());
                if (nodeData !== null && nodeData.type === 'exercise') {
                    let text = "";
                    if (nodeData.timeOpen) {
                        text += `${DateTimeHelper.toRelTime(nodeData.timeOpen)}开始`;
                    }
                    if (nodeData.timeClose) {
                        if (nodeData.timeOpen) {
                            text += "，";
                        }
                        text += `${DateTimeHelper.toRelTime(nodeData.timeClose)}截止`;
                    }

                    const displayInnerNew = $(`<span id="rghRelTime" style="display:none">${text}</span>`);
                    if (displayInner.text() !== displayInnerNew.text() || displayInner === null) {
                        if (displayInner !== null) {
                            displayInner.remove();
                        }
                        display.append(displayInnerNew);
                        displayInnerNew.fadeIn();
                    }
                }
            }
        }
    }

    class QuestionLoad {
        static load = null;
        static answer = null;

        static updateLoad(newLoad) {
            QuestionLoad.load = QuestionTree.getNodeFromRealId(newLoad.currentEid);
            QuestionLoad.answer = null;
            if (QuestionLoad.load) {
                const nodeData = QuestionLoad.load;
                Logger.info(`题目详情加载完成（实际ID：${nodeData.realId}，章节：${nodeData.sectionId}）`);
            } else {
                console.warn("Not parsed question load");
            }
        }

        static updateAnswer(nodeData, content) {
            QuestionLoad.answer = {
                realId: nodeData.realId,
                sectionId: nodeData.sectionId,
                content: content
            };
            if (content) {
                Logger.info(`参考答案获取完成（实际ID：${nodeData.realId}，章节：${nodeData.sectionId}）`);
            }
        }

        static ensureToolBar() {
            const wrapper = $('#exercise_submit');
            if (!$('#rghToolBar').length && wrapper.length) {
                const toolBar = $(`
                    <div id="rghToolBar" class="mgt10 bold" style="display:none">
                        <div class="fl clearfix mgt20">
                            <a submitbtn="1" class="f_button4 btn" id="rghForceSubmit">强制提交</a>
                            &nbsp;
                            <a class="f_button4 btn" id="rghForceShowAnswer">强制显示答案</a>
                            &nbsp;
                            <a class="f_button4 btn" id="rghOneClickAnswer">一键答题</a>
                            &nbsp;
                            <a class="f_button4 btn" id="rghBatchAnswer">批量答题</a>
                            &nbsp;
                            <a class="f_button4 btn" id="rghGlobalBatch" style="background:#e85d04;color:#fff">全局答题</a>
                        </div>
                    </div>
                `);
                toolBar.find('#rghForceShowAnswer').click(() => {
                    $('#rghAnswerDisplay').slideToggle();
                    QuestionLoad.showForceAnswer();
                });
                toolBar.find('#rghOneClickAnswer').click(() => {
                    OneClickAnswer.execute();
                });
                toolBar.find('#rghBatchAnswer').click(() => {
                    BatchAnswer.start(false);
                });
                toolBar.find('#rghGlobalBatch').click(() => {
                    BatchAnswer.start(true);
                    BatchAnswer._expandTreeNodes();
                });
                const answerDisplay = $(`
                    <div id="rghAnswerDisplay" style="display:none">
                        <div class="bold mgt30">参考答案:</div>
                        <div class="mgt10 article bluebg scroll">
                            <pre></pre>
                        </div>
                    </div>
                `);
                wrapper.append(toolBar);
                wrapper.append(answerDisplay);
                toolBar.slideDown();
            }
        }

        static showForceSubmit() {
            const nodeData = QuestionLoad.load;
            if (nodeData) {
                QuestionLoad.ensureToolBar();
                const btn = $('#rghForceSubmit');
                if (btn.length) {
                    switch (nodeData.exerciseType) {
                        case '0':
                            btn.prop('href', `javascript:submitSel(${nodeData.realId},0,0,${nodeData.sectionId})`);
                            break;
                        case '1':
                            btn.prop('href', `javascript:submitFill(${nodeData.realId},0,0,${nodeData.sectionId})`);
                            break;
                        case '2':
                            btn.prop('onclick', `return setmyselflanguage();`);
                            btn.prop('href', `javascript:submitPrg(${nodeData.realId},0,0,${nodeData.sectionId})`);
                            break;
                        default:
                            return;
                    }
                }
            }
        }

        static showForceAnswer() {
            const nodeData = QuestionLoad.load;
            const answerDisplay = $('#rghAnswerDisplay');
            const answerDisplayPre = answerDisplay.find('pre');
            if (nodeData && answerDisplay.length && answerDisplayPre.length) {
                if (!QuestionLoad.isCurrentLoadNode(QuestionLoad.answer)) {
                    answerDisplayPre.html("正在获取参考答案...");

                    const finalNodeData = JSON.parse(JSON.stringify(nodeData));
                    QuestionLoad.updateAnswer(finalNodeData, null);

                    XHRSender.get(
                        `http://ucb.ustb.edu.cn/studentHome/popup?type=key&id=${finalNodeData.realId}&c_a_r=1&section_id=${finalNodeData.sectionId}&sign=0`,
                        (data) => {
                            if (!QuestionLoad.isCurrentLoadNode(finalNodeData)) {
                                console.log("Answer response fetched but node changed");
                                return;
                            }
                            QuestionLoad.ensureToolBar();
                            QuestionLoad.updateAnswer(finalNodeData, null);

                            const parsedHtml = $('<section>').append(data);
                            let answerDiv;
                            let answerStr;
                            if ((answerDiv = parsedHtml.find('#div_box_2')).length) {
                                answerStr = answerDiv.html();
                                answerStr = QuestionLoad.trimStringAlt(answerStr);
                                QuestionLoad.updateAnswer(finalNodeData, answerStr);
                            } else if ((answerDiv = parsedHtml.find('#div_box_1')).length) {
                                const jsVarMatch = /var\s+init_obj\s*=\s*(.+);/g.exec(parsedHtml.html());
                                if (jsVarMatch !== null) {
                                    const jsContentMatch = /['"]content['"]\s*:\s*['"](.+)['"]\s*,\s*['"]courseLang['"]\s*:/g.exec(jsVarMatch[1]);
                                    if (jsContentMatch !== null) {
                                        answerStr = jsContentMatch[1];
                                        answerStr = QuestionLoad.decodeRawJSONString(answerStr);
                                        answerStr = QuestionLoad.trimString(answerStr);
                                        QuestionLoad.updateAnswer(finalNodeData, answerStr);
                                    }
                                }
                            } else {
                                console.warn("Unknown answer response");
                            }

                            answerDisplayPre.html(QuestionLoad.answer.content);

                            const copyBtn = $(`<a class="f_button4 btn" style="font-weight:bold">复制</a>`);
                            copyBtn.click(() => {
                                const textArea = $(`<textarea style='position:absolute;top:-9999px;left:-9999px;z-index:-9999'>`);
                                $('body').append(textArea);
                                textArea.val(answerDisplayPre.text()).select();
                                try {
                                    if (document.execCommand('copy')) {
                                        copyBtn.text("复制成功");
                                        Logger.info("参考答案已复制到剪贴板");
                                    } else {
                                        throw Error("Unable to execute copy command");
                                    }
                                } catch (err) {
                                    copyBtn.text("复制失败");
                                    console.warn("Unable to execute copy command");
                                }
                                textArea.remove();
                            });
                            answerDisplay.append(copyBtn);
                        }
                    );
                }
            }
        }

        static trimString(str) {
            return str.trim();
        }

        static trimStringAlt(str) {
            return str.trim().replaceAll('<br>\n', '\n').replaceAll('\n<br>', '\n');
        }

        static decodeRawJSONString(str) {
            return JSON.parse(`"${str.replaceAll('\"', '\\\"')}"`);
        }

        static isCurrentLoadNode(nodeData) {
            if (!nodeData || !QuestionLoad.load)
                return false;
            return nodeData.realId == QuestionLoad.load.realId && nodeData.sectionId == QuestionLoad.load.sectionId;
        }
    }

    class OneClickAnswer {
        static execute(onComplete) {
            const nodeData = QuestionLoad.load;
            if (!nodeData) {
                Logger.info("未加载题目");
                if (onComplete) onComplete();
                return;
            }
            QuestionLoad.ensureToolBar();
            Logger.info("正在获取答案...");

            XHRSender.get(
                `http://ucb.ustb.edu.cn/studentHome/popup?type=key&id=${nodeData.realId}&c_a_r=1&section_id=${nodeData.sectionId}&sign=0`,
                (data) => {
                    if (!QuestionLoad.isCurrentLoadNode(nodeData)) {
                        if (onComplete) onComplete();
                        return;
                    }

                    const parsedHtml = $('<section>').append(data);
                    let answerDiv, filled = false;

                    if ((answerDiv = parsedHtml.find('#div_box_2')).length) {
                        switch (nodeData.exerciseType) {
                            case '0': filled = OneClickAnswer.fillSelection(answerDiv); break;
                            case '1': filled = OneClickAnswer.fillBlank(answerDiv); break;
                        }
                    } else if ((answerDiv = parsedHtml.find('#div_box_1')).length) {
                        filled = OneClickAnswer.fillProgram(parsedHtml);
                    }

                    if (filled) {
                        Logger.info("答案已填入，即将提交...");
                        setTimeout(() => {
                            OneClickAnswer.doSubmit(nodeData);
                            if (onComplete) setTimeout(onComplete, 1500);
                        }, 600);
                    } else {
                        Logger.info("自动填入失败，请手动查看答案");
                        if (!BatchAnswer.running) QuestionLoad.showForceAnswer();
                        if (onComplete) onComplete();
                    }
                }
            );
        }

        static fillSelection(answerDiv) {
            const body = $('#exercise_submit').parent();
            const radios = body.find('input[type=radio]');
            if (!radios.length) {
                const checks = body.find('input[type=checkbox]');
                if (checks.length) return OneClickAnswer.fillSelectionCheckbox(answerDiv, checks);
                return false;
            }

            // 答案格式统一为 "X、正确."，有且只有一个"正确"，分隔符无意义
            const text = answerDiv.text().trim();
            const m = text.match(/([A-D])[、，。]正确/);
            if (m) {
                const optIdx = m[1].charCodeAt(0) - 65;
                if (optIdx >= 0 && optIdx < radios.length) {
                    $(radios[optIdx]).prop('checked', true).trigger('click');
                    Logger.info(`已选择选项 ${m[1]}`);
                    return true;
                }
            }
            return false;
        }

        static fillSelectionCheckbox(answerDiv, checks) {
            const text = answerDiv.text().trim();
            const m = text.match(/([A-D])[、，。]正确/);
            if (m) {
                const optIdx = m[1].charCodeAt(0) - 65;
                if (optIdx >= 0 && optIdx < checks.length) {
                    $(checks[optIdx]).prop('checked', true).trigger('click');
                    Logger.info(`已勾选选项 ${m[1]}`);
                    return true;
                }
            }
            return false;
        }

        static fillBlank(answerDiv) {
            let answerText = answerDiv.text().trim();
            if (!answerText || answerText === '0') {
                answerText = answerDiv.html().trim()
                    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
                    .replace(/<br\s*\/?>/gi, '')
                    .trim();
            }
            if (!answerText) return false;

            // ACE 编辑器优先
            if (typeof ace !== 'undefined') {
                const ed = $('.ace_editor').first();
                if (ed.length) {
                    ace.edit(ed[0]).setValue(answerText, -1);
                    Logger.info(`已填入答案(ACE): ${answerText}`);
                    return true;
                }
            }

            // 普通输入框
            const body = $('#exercise_submit').parent();
            const input = body.find('input[type=text], textarea').first();
            if (input.length) {
                input.val(answerText).trigger('change');
                Logger.info(`已填入答案: ${answerText}`);
                return true;
            }
            return false;
        }

        static fillProgram(parsedHtml) {
            const jsMatch = /var\s+init_obj\s*=\s*(.+);/g.exec(parsedHtml.html());
            if (!jsMatch) return false;
            const ctMatch = /['"]content['"]\s*:\s*['"](.+)['"]\s*,\s*['"]courseLang['"]\s*:/g.exec(jsMatch[1]);
            if (!ctMatch) return false;

            let code = QuestionLoad.decodeRawJSONString(ctMatch[1]);
            const temp = document.createElement('textarea');
            temp.innerHTML = code;
            code = temp.value;

            if (typeof ace !== 'undefined') {
                const ed = $('.ace_editor').first();
                if (ed.length) {
                    ace.edit(ed[0]).setValue(code, -1);
                    Logger.info("代码已填入ACE编辑器");
                    return true;
                }
            }
            const ta = $('textarea').first();
            if (ta.length) {
                ta.val(code).trigger('change');
                Logger.info("代码已填入textarea");
                return true;
            }
            return false;
        }

        static doSubmit(nodeData) {
            const btn = $('#rghForceSubmit');
            if (btn.length) {
                const href = btn.prop('href');
                if (href && href !== '#' && href !== window.location.href) {
                    btn[0].click();
                    Logger.info("已触发提交");
                    return;
                }
            }
            const fnMap = { '0': 'submitSel', '1': 'submitFill', '2': 'submitPrg' };
            const fn = fnMap[nodeData.exerciseType];
            if (fn && typeof unsafeWindow[fn] === 'function') {
                if (nodeData.exerciseType === '2' && typeof unsafeWindow.setmyselflanguage === 'function') {
                    unsafeWindow.setmyselflanguage();
                }
                unsafeWindow[fn](nodeData.realId, 0, 0, nodeData.sectionId);
                Logger.info("已调用提交函数");
            }
        }
    }

    class ManualQueue {
        static items = [];

        static add(realId, reason) {
            if (ManualQueue.items.find(i => i.realId === realId)) return;
            ManualQueue.items.push({ realId, reason, time: new Date().toLocaleTimeString() });
            ManualQueue._render();
        }

        static _render() {
            let panel = $('#rghManualPanel');
            if (!panel.length) {
                panel = $(`
                    <div id="rghManualPanel" style="position:fixed;left:5px;bottom:60px;max-width:340px;max-height:320px;
                        overflow-y:auto;background:#fff;border:2px solid #e85d04;border-radius:8px;padding:8px 10px;
                        z-index:9999;font-size:12px;box-shadow:0 3px 16px rgba(0,0,0,.35);display:none">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                            <span class="bold" style="color:#e85d04">需人工处理</span>
                            <span id="rghManualCount" class="bold" style="background:#e85d04;color:#fff;
                                border-radius:10px;padding:0 6px;font-size:11px;line-height:18px">0</span>
                        </div>
                        <div id="rghManualList" style="max-height:260px;overflow-y:auto"></div>
                    </div>
                `);
                $('body').append(panel);
            }
            if (ManualQueue.items.length > 0) {
                panel.show();
                $('#rghManualCount').text(ManualQueue.items.length);
                const list = $('#rghManualList').empty();
                for (const item of ManualQueue.items.slice(-20)) {
                    list.append(
                        $(`<div style="padding:3px 0;border-bottom:1px solid #f0f0f0;word-break:break-all">
                            <span style="color:#999;font-size:10px">${item.time}</span>
                            <span class="bold" style="color:#333">#${item.realId}</span>
                            <span style="color:#666">${item.reason}</span>
                        </div>`)
                    );
                }
            } else {
                panel.hide();
            }
        }
    }

    class BatchAnswer {
        static running = false;
        static processed = 0;
        static skipped = 0;
        static timer = null;
        static sectionLoadTimer = null;
        static lastCompletedId = null;
        static lastFailedId = null;
        static multiSection = false;
        static failedIds = new Set();
        static currentSectionId = null;

        static start(multiSection) {
            if (BatchAnswer.running) { BatchAnswer.stop(); return; }
            BatchAnswer.running = true;
            BatchAnswer.processed = 0;
            BatchAnswer.skipped = 0;
            BatchAnswer.lastCompletedId = null;
            BatchAnswer.lastFailedId = null;
            BatchAnswer.failedIds = new Set();
            BatchAnswer.multiSection = !!multiSection;
            BatchAnswer.currentSectionId = QuestionLoad.load ? QuestionLoad.load.sectionId : null;
            // 批量模式下静默吞掉所有 alert（平台用原生 alert 提示"没有下一题"）
            unsafeWindow.alert = function() {};
            const btn = $('#rghBatchAnswer');
            btn.text('停止');
            btn.css({ background: '#c00', color: '#fff' });
            if (multiSection) {
                $('#rghGlobalBatch').text('停止');
                $('#rghGlobalBatch').css({ background: '#c00', color: '#fff' });
            }
            Logger.info(multiSection ? "全局答题模式启动" : "批量答题模式启动");
            BatchAnswer.doStep();
        }

        static stop() {
            BatchAnswer.running = false;
            BatchAnswer._clearTimer();
            BatchAnswer._clearSectionTimer();
            const btn = $('#rghBatchAnswer');
            btn.text('批量答题');
            btn.css({ background: '', color: '' });
            const gbtn = $('#rghGlobalBatch');
            gbtn.text('全局答题');
            gbtn.css({ background: '', color: '' });
            Logger.info(`批量答题结束: 完成${BatchAnswer.processed}题, 跳过${BatchAnswer.skipped}题, 需人工${ManualQueue.items.length}题`);
        }

        static _clearTimer() {
            if (BatchAnswer.timer) { clearTimeout(BatchAnswer.timer); BatchAnswer.timer = null; }
        }

        static _clearSectionTimer() {
            if (BatchAnswer.sectionLoadTimer) { clearTimeout(BatchAnswer.sectionLoadTimer); BatchAnswer.sectionLoadTimer = null; }
        }

        static _setTimer(fn, ms) {
            BatchAnswer._clearTimer();
            BatchAnswer.timer = setTimeout(() => { BatchAnswer.timer = null; fn(); }, ms);
        }

        static onExerciseLoaded() {
            if (!BatchAnswer.running) return;
            BatchAnswer._clearSectionTimer();
            BatchAnswer._setTimer(() => BatchAnswer.doStep(), 1500);
        }

        static doStep() {
            if (!BatchAnswer.running) return;
            BatchAnswer._clearTimer();

            const node = QuestionLoad.load;
            if (!node) {
                BatchAnswer._setTimer(() => BatchAnswer.doStep(), 1000);
                return;
            }

            if (BatchAnswer.failedIds.has(String(node.realId))) {
                if (BatchAnswer.lastFailedId === node.realId) {
                    if (BatchAnswer.multiSection && BatchAnswer._goToNextSection()) {
                        BatchAnswer.lastCompletedId = null;
                        BatchAnswer.lastFailedId = null;
                        return;
                    }
                    Logger.info("连续遇到失败题目，批量答题结束");
                    BatchAnswer.stop();
                    return;
                }
                BatchAnswer.lastFailedId = node.realId;
                BatchAnswer.skipped++;
                Logger.info(`[跳过] #${node.realId} 之前失败,需人工 (已跳过${BatchAnswer.skipped})`);
                BatchAnswer.doNext();
                return;
            }
            BatchAnswer.lastFailedId = null;

            const treeNode = QuestionTree.getNodeFromRealId(node.realId);
            const feedbackShown = $('#feedbackBox').is(':visible');
            const feedbackCorrect = feedbackShown && $('#feedbackBox p:contains("回答正确")').length > 0;
            const pageScore = $('#my_score').text().trim();
            const isCompleted = feedbackCorrect || pageScore === '1' || (treeNode && (
                treeNode.correctSign === 1 || treeNode.correctSign === '1'
            ));

            if (isCompleted) {
                if (BatchAnswer.lastCompletedId === node.realId) {
                    if (BatchAnswer.multiSection && BatchAnswer._goToNextSection()) {
                        BatchAnswer.lastCompletedId = null;
                        return;
                    }
                    Logger.info("批量答题结束");
                    BatchAnswer.stop();
                    return;
                }
                BatchAnswer.lastCompletedId = node.realId;
                BatchAnswer.skipped++;
                Logger.info(`[跳过] #${node.realId} 已完成 (已跳过${BatchAnswer.skipped})`);
                BatchAnswer.doNext();
                return;
            }

            BatchAnswer.lastCompletedId = null;
            BatchAnswer.processed++;
            Logger.info(`[${BatchAnswer.processed}] 答题 #${node.realId} 类型:${node.exerciseType}`);
            QuestionLoad.ensureToolBar();

            OneClickAnswer.execute(() => {
                if (!BatchAnswer.running) return;
                BatchAnswer._setTimer(() => {
                    if (!BatchAnswer.running) return;
                    const fbNow = $('#feedbackBox');
                    const isCorrect = fbNow.is(':visible') && fbNow.find('p:contains("回答正确")').length > 0;
                    const scoreNow = $('#my_score').text().trim();
                    if (!isCorrect && scoreNow !== '1') {
                        const curNode = QuestionLoad.load;
                        const id = curNode ? String(curNode.realId) : '';
                        if (id) BatchAnswer.failedIds.add(id);
                        ManualQueue.add(id, scoreNow === '0' ? '提交反馈非正确' : '未确认提交结果');
                        Logger.info(`#${id} 提交可能失败，加入人工处理队列`);
                    }
                    BatchAnswer.doNext();
                }, 3000);
            });
        }

        static doNext() {
            if (!BatchAnswer.running) return;
            BatchAnswer._clearTimer();
            const nextBtn = $('a.b_after');
            if (nextBtn.length) {
                nextBtn[0].click();
                BatchAnswer._setTimer(() => {
                    if (BatchAnswer.running) BatchAnswer.doStep();
                }, 5000);
            } else {
                Logger.info("已到末尾，批量答题结束");
                BatchAnswer.stop();
            }
        }

        static _goToNextSection() {
            BatchAnswer._expandTreeNodes();
            if (!BatchAnswer.running) return false;
            // 等待异步 ajaxGetNodes 加载完各章节的节节点后再收集
            BatchAnswer._setTimer(() => BatchAnswer._doNextSection(), 5000);
            return true;
        }

        static _doNextSection() {
            if (!BatchAnswer.running) return;
            const allSections = [];
            const walk = (nodes) => {
                if (!nodes) return;
                for (const n of nodes) {
                    if (n.type === 'section') allSections.push(n);
                    if (n.children) walk(n.children);
                }
            };
            try {
                const roots = unsafeWindow.ztree ? unsafeWindow.ztree.getNodes() : [];
                for (const root of roots) walk(root.children);
            } catch(e) {}

            const currentSid = BatchAnswer.currentSectionId;
            const curIdx = allSections.findIndex(s => s.realId == currentSid);

            if (curIdx >= 0 && curIdx < allSections.length - 1) {
                const next = allSections[curIdx + 1];
                Logger.info(`进入下一章节: ${next.name}`);
                BatchAnswer._navigateToSection(next.realId);
            } else {
                Logger.info("无更多章节，全局答题结束");
                BatchAnswer.stop();
            }
        }

        static _navigateToSection(sectionId) {
            BatchAnswer._clearSectionTimer();
            BatchAnswer._expandTreeNodes();
            BatchAnswer.currentSectionId = sectionId;

            let attempts = 0;
            const doClick = () => {
                if (!BatchAnswer.running || attempts >= 10) return;
                attempts++;
                try {
                    const zNode = unsafeWindow.ztree ? unsafeWindow.ztree.getNodeByParam('realId', sectionId, null) : null;
                    if (!zNode) return;

                    if (!zNode.open && zNode.isParent) {
                        unsafeWindow.ztree.expandNode(zNode, true, false);
                        setTimeout(doClick, 3000);
                        return;
                    }

                    // 点击该节的第一个题目，而非节本身
                    if (zNode.children && zNode.children.length > 0) {
                        const firstEx = zNode.children[0];
                        const aEl = document.getElementById(firstEx.tId + '_a');
                        if (aEl) { aEl.click(); return; }
                    } else {
                        Logger.info("章节无题目，跳过");
                        BatchAnswer._goToNextSection();
                        return;
                    }
                } catch(e) {}
                setTimeout(doClick, 2000);
            };

            setTimeout(doClick, 2000);

            BatchAnswer.sectionLoadTimer = setTimeout(() => {
                if (!BatchAnswer.running) return;
                Logger.info("章节加载超时，跳过");
                BatchAnswer._goToNextSection();
            }, 20000);
        }

        static _expandTreeNodes() {
            try {
                if (typeof unsafeWindow.ztree === 'undefined') return;
                const roots = unsafeWindow.ztree.getNodes();
                for (const root of roots) {
                    if (!root.open) unsafeWindow.ztree.expandNode(root, true, false);
                    if (root.children) {
                        for (const ch of root.children) {
                            if (ch.isParent && !ch.open) unsafeWindow.ztree.expandNode(ch, true, false);
                            if (ch.children) {
                                for (const sec of ch.children) {
                                    if (sec.isParent && !sec.open) unsafeWindow.ztree.expandNode(sec, true, false);
                                }
                            }
                        }
                    }
                }
            } catch(e) {}
        }

    }

    class QuestionTree {
        static nodes = {}

        static updateNodes(newNodes) {
            newNodes.forEach((e) => {
                QuestionTree.nodes[e.realId] = ({
                    name: e.name,
                    type: e.type,
                    realId: e.realId,
                    sectionId: e.section_id,
                    exerciseType: e.etype,
                    timeOpen: e.start_time,
                    timeClose: e.done_time,
                    correctSign: e.correct_sign,
                    myscore: e.myscore,
                    answerNum: e.answerNum
                })
            });
            Logger.info("节点列表加载完成（节点数量：" + Object.entries(newNodes).length + "）");
        }

        static getNodeFromName(name) {
            for (const [id, data] of Object.entries(this.nodes)) {
                if (data.name == name) {
                    return data;
                }
            }
            return null;
        }

        static getNodeFromRealId(realId) {
            for (const [id, data] of Object.entries(this.nodes)) {
                if (data.realId == realId) {
                    return data;
                }
            }
            return null;
        }
    }

    class Logger {
        static title = "RGHelper";

        static showStatusBar() {
            if ($('#rgLogContent').length === 0) {
                $('.buttom').empty();
                $('.buttom').append(`
                <p class="rg-log">
                    <span class="bold">已启用 USTB RG Helper Enhanced v1.2</span>
                    <pre id="rgLogContent" class="rg-log-info"></pre>
                </p>
                `);
            }
        }

        static info(msg) {
            console.log("[" + Logger.title + "]", msg);
            $('#rgLogContent').text(msg);
        }
    }

    class XHRSender {
        static get(url, callback) {
            $.ajax({
                type: 'GET',
                url: url,
                async: true,
                beforeSend: (xhr) => {},
                success: (data, status, xhr) => {
                    callback(data);
                },
                error: (xhr, options, err) => {
                    console.error("Request sending failed", err)
                }
            });
        }
    }

    class XHRSpy {
        static listeners = [];
        static originalSend = XMLHttpRequest.prototype.send;
        static replacedSend = XMLHttpRequest.prototype.send = function(...args) {
            const xhr = this;
            xhr.addEventListener('readystatechange', () => XHRSpy.listeners.forEach((l) => l(xhr)));
            return XHRSpy.originalSend.apply(xhr, args);
        };

        static add(pathNamePrefix, handler) {
            XHRSpy.listeners.push(function(xhr) {
                if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                    let url = new URL(xhr.responseURL);
                    if (url.pathname.startsWith(pathNamePrefix)) {
                        let json;
                        try {
                            json = JSON.parse(xhr.responseText);
                        } catch (err) {
                            console.error("Response parsing failed", err);
                        }
                        try {
                            handler(json, url);
                        } catch (err) {
                            console.error("Response handling failed", err);
                        }
                    }
                }
            });
        }
    }

    // Listen on nodes updates
    XHRSpy.add('/studentExercise/ajaxGetNodes', (data, url) => {
        QuestionTree.updateNodes(data);
    });

    // Listen on question loading responses
    XHRSpy.add('/studentExercise/ajaxLoad', (data, url) => {
        QuestionLoad.updateLoad(data);
        if (BatchAnswer.running) BatchAnswer.onExerciseLoaded();
    });

    setInterval(() => {
        DateTimeHelper.showRelTimeOnArticle();
        QuestionLoad.showForceSubmit();
        Logger.showStatusBar();
    }, 500);

})();
