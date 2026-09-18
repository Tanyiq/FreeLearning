# Domain Agent Workbench V1

Windows 本地 Electron 工作台，用 Project 与 Skill 组织现有 CodeAgent CLI。Workbench 不实现 Agent Runtime，也不复制领域知识库。

## 前置条件

- Windows 10/11
- Node.js 20+
- Git（用于状态展示）
- `D:\\codeagentCli\\codeagent.bat`
- `D:\\codeagentCli\\codeagent-node.exe`（由 CodeAgent 首次初始化生成）

以上是默认位置。启动后可通过顶部 `Runtime` → `Choose BAT…` 选择其他 `codeagent.bat`；Workbench 会在所选 BAT 的同目录检查 `codeagent-node.exe`，并持久保存该设置。

## 开发

```powershell
npm install
npm run dev
```

也可以直接双击仓库根目录的 `START-WORKBENCH.cmd`。它会优先启动已打包的便携版，未打包时回退到本地 Electron。

构建检查与单元测试：

```powershell
npm test
npm run build
```

生成可直接双击的 Windows 便携版 EXE：

```powershell
npm run package:portable
```

Windows 上也可以直接双击仓库根目录的 `BUILD-PORTABLE.cmd`。脚本会检查 Node.js；系统有 pnpm 时直接使用，没有时通过 `npx` 临时运行 pnpm，无需全局安装。随后脚本会安装依赖、执行生产编译，并在完成后打开 `release` 目录。首次打包需要联网下载依赖。

产物位于 `release/Domain-Agent-Workbench-<version>-x64.exe`，可复制到任意位置启动。

如需传统安装包：

```powershell
npm run package:installer
```

## 可插拔 Project

Workbench 顶部支持添加、切换和移除多个 Domain Project。注册信息保存在当前 Windows 用户的 Electron `userData` 目录中；只保存路径，不复制或删除 Project、Knowledge、Sources、Repo 等内容。移除后随时可以重新添加。

## Project 约定

选择的根目录必须包含 `.cac/skills/`。Workbench 扫描 `.cac/skills/*/SKILL.md`，并按目录名后缀识别：

- `*-qa` → QA
- `*-dev` → DEV
- `*-review` → REVIEW
- `*-knowledge-refresh` → REFRESH

CodeAgent 始终以 Project 根目录作为 `cwd`，并仅通过 `D:\\codeagentCli\\codeagent.bat` 启动。

## Session 规则

- QA：同一 Project 下复用运行中的 QA Session。
- DEV：每次启动新 Session。
- REVIEW：每次启动新的独立 Session，并发送原始需求与目标 commit。
- REFRESH：每次启动新 Session。
# FreeLearning
