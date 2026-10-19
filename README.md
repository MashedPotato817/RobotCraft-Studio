# RobotCraft Studio

面向课堂演示的机器人创作仿真工作站。目标是让同一份文字或图案，通过笔、钻头或裱花嘴三类虚拟工具生成不同制作效果。

本项目仅做软件仿真，重点是路径规划、末端姿态、工艺动作和结果的可解释展示。

## 当前状态

2026-10-19：已建立独立仓库骨架，迁移原项目的运动学、轨迹算法和 7 项回归测试。网页只有启动占位页，三类工艺、编辑器和三维工作站尚未实现。

技术路线采用 TypeScript、Vite、Three.js、Vitest。初期使用原生 DOM/CSS 组织交互，保持计算、播放与渲染分离；较长规划任务后续放到 Web Worker。依赖锁定沿用旧项目，本次不升级依赖。

## 本地运行

```powershell
Set-Location 'C:\Users\Mashed Potato\Desktop\2609机器人技术基础(王振)\project\RobotCraft-Studio'
npm.cmd ci
npm.cmd run dev
```

打开 <http://127.0.0.1:5174/>。端口与旧项目的 5173 分开。

## 验证

```powershell
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
```

现有测试验证迁移算法基线；不能据此宣称写字、钻孔或裱花功能已经可用。

## 文档入口

- [产品范围、技术路线与整体架构](docs/superpowers/specs/2026-10-19-robotcraft-design.md)
- [迁移来源、文件对照与验证记录](docs/migration.md)

## 本阶段分工

- 用户：选择首个演示案例并审阅产品范围。
- 开发者：维护迁移基线、实现分阶段功能并提供验证证据。

后续先完成“笔在平面上绘制多笔画图案”的闭环，再接入钻孔孔阵与裱花几何效果。详细验收条件见架构文档。
