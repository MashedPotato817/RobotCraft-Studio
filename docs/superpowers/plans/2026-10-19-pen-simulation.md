# 笔绘基础仿真 Implementation Plan

> **For agentic workers:** 使用 superpowers:executing-plans 在当前会话逐项实施，完成后独立审查整个分支。

**Goal:** 完成预设多笔画图案从规划到机械臂实际笔迹的 S1 闭环。

**Architecture:** 图案与笔工艺生成带工具状态的目标，机器人模块处理 TCP/单位换算和 IK，仿真模块按时间读取规划并生成笔迹，Three.js 只消费同一执行记录。较长规划在 Worker 中进行，过期结果丢弃。

**Tech Stack:** TypeScript、Vite、Three.js、Vitest；沿用依赖锁定。

**Spec:** ../specs/2026-10-19-robotcraft-design.md

## Global Constraints

- 纯浏览器仿真；毫米、秒、弧度；旧算法 1 u = 10 mm。
- 保留 `src/core/` 迁移基线；笔尖 TCP 与法兰区分。
- 实际笔迹来自相同关节执行记录，暂停不走时、重置清空、完成保留末状态。
- 工具与工件参数变更使旧规划失效；未收敛不等于几何不可达；未检查碰撞。

## Review Focus

1. 多笔画跳转不能连出墨线。
2. 不同渲染帧率与倍速不能遗漏或重复笔迹。
3. 规划失败和旧 Worker 结果不能播放旧任务。
4. TCP 偏置与长度换算不能让法兰代替笔尖绘图。
5. 空值、非有限数值与边界参数必须拒绝，恢复后能重新规划。

## Task 1：图案、工艺与机器人规划

文件：新增 `src/design/patterns.ts`、`src/process/pen.ts`、`src/robot/planner.ts` 与 `tests/pen-planning.test.ts`。

接口：`createPenJob(settings)` 返回工件、笔尖目标与笔画状态；`planPenJob(job)` 返回时间戳、关节样本、FK 笔尖、误差及总时长；`tcpPose(q, penLengthMm)` 返回 mm 下的实际笔尖位姿。

- [x] 先写测试，覆盖多笔画抬笔、TCP 偏置、单位换算、参数校验与所有预设的误差/关节限制。
- [x] 运行 `npm.cmd run test -- tests/pen-planning.test.ts` 确认缺少功能，再最小实现并验证通过。
- [x] 对每个加工段保持竖直笔姿，位置误差阈值 0.5 mm、姿态误差 0.07 rad；规划失败返回诊断而非可播放任务。

## Task 2：确定性播放与实际笔迹

文件：新增 `src/simulation/playback.ts`、`tests/playback.test.ts`。

接口：`Playback` 管理 ready/playing/paused/completed，`advance(deltaSeconds)`、`setSpeed(value)`、`reset()`，`snapshot()` 提供 q、实际 TCP、已完成笔迹与进度。

- [x] 先测试暂停/恢复、末态保留、重置清空、多笔画不连线、不同帧步长结果一致、拒绝非法时间和倍速。
- [x] 运行对应测试确认缺少功能，再实现并验证；位姿与笔迹由同一个时间轴决定。

## Task 3：浏览器工作站

文件：新增 `src/robot/planning.worker.ts`、`src/rendering/workspace.ts`、`src/app/workstation.ts`；修改入口、样式与页面，更新 README 和阶段状态。

- [x] 图案提供“机器人字样、多笔画汉字、连续图形”；可调尺寸、摆放、笔长、速度、笔色。
- [x] Worker 返回序列化规划，修改参数立即作废旧任务；暂停、恢复、重置、视角恢复、纸面俯视可用。
- [x] 浅色工作站界面，关节数据折叠，固定播放控制；无实体控制与工艺物理预测承诺。
- [x] 浏览器检查参数变化、规划、播放、暂停/调速/重置、相机拖动及错误恢复，保存截图作为交付证据。
- [x] 完整运行 typecheck、test、build；独立审查分支，按项目 git-message skill 本地提交。

## 执行记录

- 既有独立项目工作区干净，在 `feat/pen-simulation` 分支内实施，不额外创建 worktree。
- 本轮用户已要求继续实现基础功能，采用当前会话连续实施与最终独立审查。
- Task 1：先添加规划测试并确认新模块尚不存在；实现后发现默认汉字路径中途超过笔尖容差。改为对整条轨迹尝试连续初值，避免途中切换逆解分支；12 项规划测试通过。
- Task 2：先添加播放测试并确认模块尚不存在；实现后 5 项播放测试通过，完整测试共 24 项通过。
- Task 3：Worker 规划与三维工作站落地；类型检查和生产构建通过。Three.js 与视角控制单独分包，无构建体积告警。
- Ruling：Windows 完整构建再次复现共享 TEMP 文件删除被拒绝；对照试验改用项目 `.cache/tmp` 后通过，将该环境设置仅封装在构建子进程，未修改系统环境、ACL 或依赖。
- 独立审查重跑 24 项测试、类型检查；发现 BFCache 与 WebGL 丢失的生命周期问题，已修正。额外检查 96 组边界组合：44 组通过，52 组返回求解诊断；成功轨迹加密采样的最大笔尖误差 0.34517 mm。
- 浏览器生产预览验证：初始规划、快速图案切换、汉字四笔完整绘制、0.5/4 倍速、暂停状态、非法 X 参数禁用播放、恢复参数重新规划、俯视与隐藏目标辅助线；拖动视角未修改图案、位置或操作模式。
- 仍未实施：钻孔、裱花、任意文字/SVG 导入、JSON 保存、碰撞与接触力模型。
