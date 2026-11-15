# 任务完成提醒

会话里的智能体一停下来，或者一转身来问你话，窗口右上角就滑出一条提醒，同时响提示音。

## 两种提醒

**运行已结束**（蓝色勾）

- 智能体停止运行时出现，停留约 7 秒后自动消失。
- 只在你「看着它」时计时：窗口失焦、页面被隐藏、鼠标悬停或键盘聚焦在提醒上时暂停，回到窗口继续走。
- 标题不代表成功——正常完成、失败、手动点停止都是这一条。运行结果本身仍在对话里。

**等你处理**（琥珀色问号）

- 智能体开始等你回答、确认方案或授权时出现，对应三种文案：「等你回答」「等你确认方案」「等你授权」。
- **不会自动消失**：一直留到你回答完（提醒自己消失）或点 × 关掉。离开片刻再回来，它还在。

两种提醒都可以点主体（标题和会话名）直接打开那个会话，点 × 关闭；最多同时堆叠 3 条。

## 声音

- 「运行已结束」：两声上行（880 Hz → 1174.66 Hz）。
- 「等你处理」：三声上行大三和弦（783.99 → 1046.5 → 1318.51 Hz），更长也更容易注意到。
- 音量在 `client.js` 的 `CHIME_GAIN`（0.32）。想更大就调高，但注意别超过 1。
- 提示音用 Web Audio 合成，插件不带音频文件。浏览器要求先有用户操作才允许出声，插件会在页面里第一次点击或按键时准备好音频设备。

## 观察的是什么

插件读取客户端本来就有的会话状态（运行状态 + 待你处理的交互类型），不读会话日志、不调用 Host、也不轮询。

- 只提醒侧边栏里列出的顶层会话；子智能体是一次运行内部的机制，它结束时不再单独提醒。
- 页面加载后的第一份状态只作为基线：本来就空闲的会话、本来就在等你的问题，都不会在你刚打开页面时补一条提醒。
- 运行在后台完成时照样提醒：提醒在那里等你，提示音在能出声时立即播放。

## 限制

- 提醒画在网页里。只有打开 Harness 网页窗口或桌面窗口时才能看到，它不是系统通知，应用关掉或窗口在别的桌面时不会出现。
- 「结束」的依据是智能体离开运行状态，所以失败的运行和成功的运行看起来一样。
- 同一段对话里每一轮、以及目标模式的每一轮续跑，都会各自提醒一次。
- 「等你处理」只在你手动关掉前有效；关掉之后，同一个问题再出现时不会再提醒（同一个请求不会重复弹）。
- 打开页面时如果恰好有运行在启动过程中结束（会话列表还没到位），那条结束不会补发提醒；此时侧边栏仍会显示完成标记。

## 常量

时长、堆叠数量和音量是 `client.js` 顶部的常量：`MAX_NOTICES`、`NOTICE_LIFETIME_MS`、`CHIME_GAIN`。待处理的提醒没有倒计时，所以要它快点消失只能手动关。插件没有 Config，修改这几个值要改文件并重启应用。

## 关掉它

在 **设置 → 插件** 里停用或移除这个 bundle。叠加层座位、样式表、词典和音频设备都会随插件一起释放。

## 安装

这是一个 DeepSeek Harness（DSH）的 bundle 插件，需要能加载 `dsh.client` 客户端插件的发行版（开发与验证于 0.2.2-rc.2）。

1. 把这个仓库 clone 或下载到本地任意目录；
2. 打开 Harness → **设置 → 插件** → **添加插件**，选择这个目录（含 `package.json` 的那一层）；
3. 安装后提醒立刻生效，不必重启；如果页面没反应，刷新一次网页。

没有 npm 依赖，也不需要构建步骤。

---

# Task complete notice

A frame-wide notice for the DeepSeek Harness web GUI: when a session's agent
stops running, or turns around to ask you something, a card slides in at the
top-right corner of the window and a chime plays.

## Two kinds of card

**Run finished** (blue check)

- Appears when the agent stops running and leaves after about seven seconds.
- The countdown only runs while you can see it: it holds while the window is
  unfocused, the page is hidden, or the card is hovered or focused, and resumes
  when you come back.
- The headline reports that the run stopped, not that it succeeded: a normal
  completion, a failure, and the Stop button all produce this card. The outcome
  itself stays in the conversation.

**Waiting for you** (amber question mark)

- Appears when the agent starts waiting for your answer, your plan review, or
  your approval, with a headline for each: "Waiting for your answer", "Waiting
  for your review", "Waiting for approval".
- It never times out: it stays until you answer (then it removes itself) or
  close it with the cross. A question asked while you were away is still there
  when you come back.

Both kinds open the session when you click the card body, and stack up to three
at a time.

## Sound

- Run finished: two rising notes (880 Hz then 1174.66 Hz).
- Waiting for you: three rising notes of a major triad (783.99, 1046.5,
  1318.51 Hz), longer and harder to miss.
- Volume is `CHIME_GAIN` at the top of `client.js` (0.32). Raising it is safe up
  to 1.
- The chime is synthesised with Web Audio, so the bundle ships no audio file.
  Browsers require a gesture before audio starts; the plugin arms the audio
  device on the first click or key press in the page.

## What is observed

The plugin reads the session state the client already receives (running state
and the kind of interaction waiting on the user). It never reads the session log,
calls the Host, or polls.

- Only sessions listed in the sidebar notify; a finished subagent run stays
  silent because the top-level run that spawned it announces its own stop.
- The first status snapshot after a page load is a baseline: sessions that were
  already idle, and questions that were already waiting, do not notify just
  because the page opened.
- A run that finishes while the page is in the background still notifies: the
  card waits for you, and the chime plays as soon as the page can play audio.

## Limits

- Rendering happens inside the page. The notice is visible only while a Harness
  web or desktop window is open and is not a system notification, so nothing
  appears when the app is closed or the window is on another desktop.
- "Finished" is the agent leaving the running state, so a failed run reads the
  same as a successful one.
- Repeated turns of one conversation each notify, and so does each continuation
  round of a goal.
- A "waiting for you" card that you close does not come back on its own; the same
  request is only announced once.
- A run that finishes during page boot, before the session list arrives, is not
  announced; the sidebar still shows its completion marker.

## Constants

Timing, stack depth, and volume are constants at the top of `client.js`:
`MAX_NOTICES`, `NOTICE_LIFETIME_MS`, and `CHIME_GAIN`. Waiting cards carry no
countdown, so closing them is the only way to clear one early. The plugin has no
Config schema, so changing these means editing that file and restarting the app.

## Turning it off

Disable or remove the bundle in **Settings → Plugins**. The overlay seat, its
styles, dictionaries, and the audio device are released with the plugin.

## Install

This is a DeepSeek Harness (DSH) bundle plugin and needs a release that loads
`dsh.client` browser halves (developed and verified on 0.2.2-rc.2).

1. Clone or download this repository anywhere on disk;
2. Open Harness → **Settings → Plugins** → **Add plugin** and pick this directory
   (the one holding `package.json`);
3. The notices start immediately, no restart needed; refresh the page once if it
   stays quiet.

No npm dependencies and no build step.
