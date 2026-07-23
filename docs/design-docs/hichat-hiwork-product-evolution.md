# HiChat 与 HiWork 产品能力演进

## 1. 结论

HiMarket 的 AI 能力演进方向是：

```text
从能聊，到能调用，再到能完成工作。
```

产品上拆成两个核心入口：

| 产品   | 定位                       | 用户心智                                       |
| ------ | -------------------------- | ---------------------------------------------- |
| HiChat | 智能调用入口               | 我想快速调用一个模型或 Agent API，验证它的效果 |
| HiWork | 类 Codex 的 Agent 工作空间 | 我给 Agent 一个目标，让它规划、执行并交付结果  |

HiCoding 的代码工作能力未来可以逐步并入 HiWork。长期看，HiWork 会成为统一的 Agent 工作空间，HiCoding 可以从独立入口演进为 HiWork 内部的代码能力。

## 2. HiChat 的产品边界

HiChat 负责调用与对话，保持轻量、直接、低门槛。

HiChat 主要支持：

- 调用 Model API。
- 调用 Agent API。
- 多模型对比。
- 图片、文件等多模态问答。
- 联网搜索。
- 基础工具调用展示。
- 对话历史保存与恢复。

HiChat 不承担复杂任务编排，不负责长期任务执行，不承载代码工作空间。

一句话边界：

```text
HiChat 负责问和调。
```

## 3. HiWork 的产品边界

HiWork 是独立页面，不是 HiChat 的高级模式。

HiWork 的模式类似 Codex：用户进入一个工作线程，描述目标，Agent 在同一个上下文里持续规划、执行、展示过程并交付产物。

HiWork 主要支持：

- 创建工作线程。
- 描述任务目标。
- 选择或切换执行模型。
- 选择 Agent Skill。
- 绑定 MCP 工具。
- 选择目标产品或项目。
- 展示 Agent 执行计划。
- 展示工具调用和执行过程。
- 对关键动作进行确认或拒绝。
- 生成并管理产物。
- 基于上下文继续追问、修改和重试。
- 管理任务相关记忆。

一句话边界：

```text
HiWork 负责做和交付。
```

## 4. 典型场景

HiChat 典型场景：

- 试用一个新模型的回答效果。
- 对比多个模型对同一问题的表现。
- 调试一个 Agent API 的输入输出。
- 上传文件后快速问答。
- 打开联网搜索获得补充信息。

HiWork 典型场景：

- 评审一个 API 产品。
- 调试一个 MCP Server。
- 调试一个 Agent API 并分析调用链路。
- 生成 SDK 或接口文档。
- 分析接口治理扣分项。
- 生成修复计划并逐步执行。
- 修改代码、运行测试、查看结果。
- 做发布前检查。

## 5. 产品能力演进阶段

### 阶段一：HiChat 从模型对话升级为智能调用入口

目标是让 HiChat 不只支持模型对话，也支持 Agent API 调用。

能力重点：

- Model API 调用。
- Agent API 调用。
- 多模型对比。
- 多模态输入。
- 对话历史。
- 基础工具调用过程展示。

用户感知：

```text
我可以在 HiChat 里快速验证平台上的模型和 Agent API。
```

### 阶段二：推出 HiWork

目标是新增独立的类 Codex Agent 工作空间。

能力重点：

- 工作线程。
- 任务目标输入。
- 模型选择。
- Skill 选择。
- MCP 工具绑定。
- 目标对象选择。
- 执行过程展示。
- 结果产物展示。

用户感知：

```text
我可以在 HiWork 里让 Agent 帮我完成一件事。
```

### 阶段三：HiWork 从任务执行升级为持续协作空间

目标是让 HiWork 支持更长周期、更复杂的 Agent 工作。

能力重点：

- 多轮协作。
- 模型中途切换。
- Skill 和工具动态调整。
- 执行计划和步骤进度。
- 权限确认。
- 任务暂停、继续、重试。
- 历史产物管理。
- 任务级和用户级记忆。

用户感知：

```text
我和 Agent 在一个工作空间里持续推进任务。
```

### 阶段四：HiCoding 能力并入 HiWork

目标是让代码类任务也在 HiWork 中完成。

能力重点：

- 文件浏览。
- 代码编辑。
- 终端执行。
- 测试运行。
- Diff 查看。
- 页面预览。
- Git 操作。

用户感知：

```text
代码任务也可以在 HiWork 里完成，不需要先切到 HiCoding。
```

## 6. 长期形态

长期产品结构：

```text
HiChat
快速调用、快速对话、快速验证。

HiWork
类 Codex 的 Agent 工作空间，负责复杂任务执行和交付。
```

HiWork 会成为 HiMarket 中统一的智能工作空间，覆盖 API、MCP、Agent API、模型、治理、文档、代码等平台工作。

长期目标不是让用户理解更多技术概念，而是让用户形成稳定心智：

```text
要快速验证，去 HiChat。
要完成工作，去 HiWork。
```

## 7. 暂定命名

当前阶段暂定：

- `HiChat`：智能调用入口。
- `HiWork`：类 Codex 的 Agent 工作空间。

页面或导航文案可采用：

```text
HiChat
HiWork
```

避免在用户侧使用过重的名称，例如 `Agent Workspace`。该类名称可以作为内部技术概念保留，但不作为优先展示文案。

## 8. 待决问题：HiChat 是否支持同一会话内切换模型

当前 HiChat 与 Product 绑定较深：

- ChatSession 创建时保存 `products` 列表，历史上保留了一个会话关联多个 Product 的空间。
- 每次 chat 请求必须传入 `productId`，模型配置、网关、凭证和 MCP 配置都从该 Product 派生。
- 当前实际产品交互中，切换模型会创建新的 session。
- 当前 `chat_memory` 按 `userId + sessionId` 保存 AgentState，不区分 `productId` 或模型。

产品体验上，同一个话题会话内支持切换模型更自然。用户理解的会话是“同一个问题上下文”，不一定希望因为切换模型而进入新的会话列表。

但后端不能简单复用同一个 `sessionId` 直接切换模型。Product 不只是模型名称，还绑定网关、凭证、MCP 工具、工具组和权限状态。如果多个 Product 共用同一份 AgentState，可能导致模型上下文、工具状态和权限状态混杂。

初步建议：

- 用户可见层面，未来可以支持在同一个 HiChat 会话内切换模型。
- 后端运行态需要按模型或 Product 隔离 AgentState。
- `chat` 表继续记录每条回答对应的 `productId`，用于展示和审计。
- `chat_memory` 不应长期只以用户可见 `sessionId` 作为唯一上下文边界。

过渡方案可以先引入内部 runtime session：

```text
visibleSessionId = 用户看到的 sessionId
runtimeSessionId = visibleSessionId + ":" + productId
```

这样可以在不立即调整 `chat_memory` 表结构的情况下，让同一用户会话下的不同模型拥有独立 AgentState。删除会话时，需要按 visible session 前缀清理所有 runtime memory。

长期方案可以考虑显式建模：

```text
chat_memory key = userId + sessionId + productId + memoryKey
```

或进一步演进为 run/conversation 级 AgentState。该问题需要在 HiChat 支持模型切换前确认，不建议在当前模型对话优化中顺手混改。

## 9. 模型对话优化收尾 TODO

本节记录当前模型对话升级后的剩余工作。问题按优先级逐项处理，每完成一项都需要补充对应测试，并更新状态。

| ID | 优先级 | 状态 | 工作项 | 完成标准 |
| -- | ------ | ---- | ------ | -------- |
| CHAT-01 | P1 | 已完成 | 完成原生 DashScope 文本模型的网关适配 | 能从 Product 路由解析 DashScope Endpoint；请求携带网关凭证；Thinking 和 Web Search 均遵循本次请求开关；新增单元测试 |
| CHAT-02 | P1 | 已完成 | 保留流式失败前已经接收的回复内容 | `SEND_ERROR` 和 `GLOBAL_ERROR` 不覆盖已有回答、Thinking、工具事件、图片分块和重试记录；新增 reducer 测试 |
| CHAT-03 | P2 | 暂缓 | 明确 OpenAI 兼容图片编辑能力边界 | 仅对支持 `/images/edits` 的模型展示并调用图片编辑；不支持时给出明确提示，不再直接返回通用 404 |
| CHAT-04 | P2 | 暂缓 | 提升长会话上下文压缩的稳定性 | 明确压缩模型和超时策略；压缩失败可观测；验证长会话不会持续无界增长或因压缩请求影响正常回答 |
| CHAT-05 | P2 | 已完成 | 避免过期附件清理积压 | 每日清理任务按每批 500 条循环处理，单次最多执行 20 批；任务记录删除总数；已补充批量清理测试 |
| CHAT-06 | P3 | 已完成 | 清理模型对话遗留代码并补齐文件头 | 已删除前端 V1 SSE 兼容代码；新增 Java 文件均包含项目 License；已通过前后端静态检查和相关测试 |

### 发布前确认

- `V23__Add_chat_image_metadata.sql` 仅允许在本地环境执行过。若共享环境已经执行，需要先制定 Flyway 修复方案，不能直接删除迁移文件后发布。
- 完成上述工作后，统一运行后端完整测试、前端测试、格式检查、类型检查和 i18n 扫描。
