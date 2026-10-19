# 迁移记录

## 来源与范围

- 日期：2026-10-19。
- 来源：同级 `Robotics-Demo`，远端标识 `https://github.com/MashedPotato817/Robotics-Demo.git`。
- 来源提交：`912894c`，原分支 `master`。迁移前工作区干净。
- 目标：独立本地仓库 `RobotCraft-Studio`，初始化阶段保留算法结果，重建产品层。

| 来源文件 | 目标文件 | 处理 |
| --- | --- | --- |
| `src/robot.ts` | `src/core/robot.ts` | 逐字节复制，保留 DH、FK/IK、雅可比、零空间优化及课程预设 |
| `src/trajectory.ts` | `src/core/trajectory.ts` | 逐字节复制，保留图形路径、关节插值和课程轨迹 |
| `src/robot.test.ts` | `tests/kinematics.test.ts` | 保留 7 项测试，仅调整两处模块导入路径 |
| `package.json` | `package.json` | 更新名称与初始版本，增加 typecheck；依赖范围保持一致 |
| `package-lock.json` | `package-lock.json` | 更新根包元数据，依赖锁定记录保持一致 |
| `tsconfig.json` | `tsconfig.json` | 保留严格选项，增加 tests 到类型检查范围 |

原 `main.ts`、样式、页面内容与 Pages 工作流不迁移：它们绑定课程面板与旧交互。新入口只有标题占位，构建配置使用相对资源路径，本地端口为 5174。

不复制 `.git`、`node_modules`、`dist`、临时文件、教材 PDF、MATLAB 工具箱或旧阶段报告。新项目从独立初始提交开始，引用来源提交作为追溯依据。

## 已知技术债

- 课程预设与数学函数仍在同一文件，当前模型固定为八自由度；本次没有顺便拆分或通用化。
- `core` 仍使用 Three.js 数学类型与旧长度单位 `u`，后续由 `robot` 模块适配，不让这些单位进入项目 JSON。
- 旧轨迹结果中的零误差字段不等于碰撞检测、工艺精度或动力学验证。
- 旧项目曾出现 esbuild 临时文件删除被拒绝。新项目单独验证构建；不把它假定为已解决或直接修改系统权限。

## 验证方式

开发者核对源文件哈希、测试文件规范化比较和 lockfile 依赖记录，再运行：

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
```

迁移后再次检查旧仓库 `git status --short`。用户通过 README 和架构文档审阅范围。

## 本次验证结果

- `npm.cmd ci --no-audit --no-fund`：完成，安装 61 个包。npm 提示未批准执行 esbuild 的 postinstall，本轮未调整安装脚本授权；当前平台依赖满足以下测试与构建。
- `npm.cmd run typecheck`：通过，包含源码与迁移测试。
- `npm.cmd run test`：7 项测试全部通过。
- `npm.cmd run build`：通过，生成启动占位页。该入口尚未引用运动学与三维场景，因此此结果不代表完整产品或后续大体积三维构建已经验证。
- `robot.ts` SHA-256：`266B68E0566FBBE023974CF3686D7A1D05C831005D638B4D1ECBFD5556656625`，源文件与目标文件一致。
- `trajectory.ts` SHA-256：`1EA1670BB45583A714A30073A29958BA5FF53A70DDD0C93373C40DF84668165B`，源文件与目标文件一致。
- 测试文件将两处 import 路径反向替换后与原文件完全一致。
- 原 `trajectory.ts` 带有末尾空行，为保持字节一致予以保留；差异格式检查仅排除 `blank-at-eof` 规则，其余空白规则正常检查。
- lockfile 归一化根包名称和版本后与来源语义一致；依赖版本未升级。
- 迁移后旧仓库 `git status --short` 无输出，HEAD 保持 `912894cb97b5a614e32779b4db8df8f8d328b016`。
- 独立只读架构审阅：没有发现会阻碍下一阶段规划的重要遗漏。

以上均为软件迁移与占位构建验证；写字、钻孔、裱花三类仿真尚待实现。
