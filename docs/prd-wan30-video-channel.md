# PRD：万相 3.0 视频生成（新 Channel + Playground 适配）

> 状态：待开发  
> 日期：2026-08-25  
> 范围：新增独立 channel 类型，转发阿里云百炼 **万相 3.0（All-in-One）** 异步视频生成；在 Playground 的 Video 页提供完整参数与媒体输入  
> 上游文档：万相 3.0 视频生成 HTTP 异步接口（创建任务 + 轮询结果）  
> 相关设计：[`docs/design-wan30-video-channel.md`](./design-wan30-video-channel.md)

---

## 1. Executive Summary

### Problem Statement

万相 3.0（`wan3.0-video` / `wan3.0-video-prime`）是统一的文生视频 / 图生视频（首帧、首尾帧）/ 参考生视频模型，最长 30 秒、30fps。调用走 **MaaS 业务空间域名**（`{WorkspaceId}.{region}.maas.aliyuncs.com`），请求体使用 `input.media[]` 的 typed URL，参数含 `ratio`、`duration=-1`（智能时长）以及 file/link 等新素材类型。

当前网关的 Ali 视频任务通道（channel 17）面向万相 2.x：默认 Base URL 是 `dashscope.aliyuncs.com`，时长默认约 5 秒且模型校验写死 2.x 列表，Playground Video 也没有对应表单。把 3.0 塞进 Ali adaptor 会污染 2.x 协议，也无法表达 workspace 地域与互斥媒体模式。

### Proposed Solution

新增高位 channel 类型 **Wan 3.0 Video**（建议 ID `963`，与 HappyHorse/Agnes Video 同属 fork 区，避免占用上游连续 ID）。独立 task adaptor 对接：

1. `POST {base}/api/v1/services/aigc/video-generation/video-synthesis`（必须 `X-DashScope-Async: enable`）
2. `GET {base}/api/v1/tasks/{task_id}` 轮询，成功后取 `output.video_url`

对外仍走现有 `/v1/video/generations` 任务链路（提交 → 预扣 → 轮询 → 结算）。Playground 增加 `wan30_video` 表单 profile，按生成模式收集 prompt、typed media 与 parameters。

### Success Criteria

1. 管理员可创建类型为 **Wan 3.0 Video** 的渠道：填写与模型/Key **同一地域** 的 Base URL（含 WorkspaceId）和 API Key；模型至少能选 `wan3.0-video`、`wan3.0-video-prime`。
2. 客户端用网关 `/v1/video/generations` 提交文生 / 首帧 / 首尾帧 / 参考 / 文件 / 网页六种合法组合时，上游请求体与官方 curl 字段一致；非法互斥组合在网关返回 **HTTP 400**，不创建上游任务、不扣费。
3. Playground Video 选中上述模型后，展示分辨率、比例、时长、音频、改写、水印、种子，以及与当前模式匹配的媒体输入；提交后能轮询到视频并可播放（成功链接有效期内）。
4. 预扣按分辨率档 + 时长计费（见 §4.5）；`duration=-1` 不得把负数当乘数；既有 Ali / HappyHorse / Agnes / Seedance 视频行为零回归。

---

## 2. User Experience & Functionality

### User Personas

| 角色 | 诉求 |
|------|------|
| 系统管理员 | 按地域配置 Workspace 域名与 Key，把万相 3.0 挂到分组与模型目录 |
| API 调用方 | 用现有视频任务 API 一次提交 prompt + media + parameters，拿到任务 ID 并轮询视频 URL |
| Playground 用户 | 在 Video 页按「生成模式」填参数和素材，不必手写 `input.media` JSON |

### User Stories

#### Story 1 — 管理员配置 Wan 3.0 Video 渠道

> As a 管理员, I want to 新增一种万相 3.0 专用渠道类型并填写地域 Endpoint 与 API Key, so that 模型、URL、Key 同属一个地域，调用不会因跨地域失败。

**Acceptance Criteria**

- 渠道类型列表出现 **Wan 3.0 Video**（i18n 键与展示名一致；中文可用「万相 3.0 视频」作为翻译）。
- 默认 Base URL **不填死北京域名**；占位提示示例：
  - 北京：`https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com`
  - 新加坡：`https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com`
  - 东京：`https://{WorkspaceId}.ap-northeast-1.maas.aliyuncs.com`
  - 法兰克福：`https://{WorkspaceId}.eu-central-1.maas.aliyuncs.com`
  - 弗吉尼亚：`https://{WorkspaceId}.us-east-1.maas.aliyuncs.com`
- 保存时 Base URL 必须是 `https://` 且 host 含 `.maas.aliyuncs.com`（或管理员明确覆盖的自定义网关）；提示「请把 `{WorkspaceId}` 换成真实业务空间 ID」。
- Key 提示：DashScope / 百炼 API Key，`Authorization: Bearer sk-…`。
- 默认模型提示：`wan3.0-video,wan3.0-video-prime`。
- 该类型只走**异步视频任务**协议，不注册为对话/流式 chat 通道。
- 不在 Ali（17）默认模型列表中加入 `wan3.0-*`，避免管理员误配到 `dashscope.aliyuncs.com`。

#### Story 2 — API 文生视频

> As an API 调用方, I want to 只传 prompt 生成视频, so that 无需准备媒体文件。

**Acceptance Criteria**

- 请求至少包含 `model` + `prompt`；`media` 可省略。
- `prompt` 按上游规则：中英混排，按字符计，超过 **20000** 网关截断或拒绝（实现选一种并在错误信息中写明；推荐 **拒绝并 400**，避免静默截断导致计费与预期不符）。
- 上游 body 形状：

```json
{
  "model": "wan3.0-video",
  "input": { "prompt": "..." },
  "parameters": { "resolution": "480P", "ratio": "adaptive", "duration": 5, "prompt_extend": true }
}
```

- 创建成功返回网关任务 ID；内部保存上游 `task_id`（有效期 24h）。
- 轮询成功后 `output.video_url` 对用户可访问（现有任务成功 URL / content 代理策略与 Ali 视频一致：上游直链即可则直链）。

#### Story 3 — 首帧 / 首尾帧生视频

> As an API 调用方, I want to 用 first_frame 与可选 last_frame 锁定视频首尾画面, so that 生成结果严格从指定帧开始/结束。

**Acceptance Criteria**

- `media` 仅允许 `first_frame`（最多 1）与 `last_frame`（最多 1）。
- 只有 `last_frame` 没有 `first_frame` → **400**。
- 与 `reference_*` / `file` / `link` 同时出现 → **400**，错误语义对齐上游：两种模式互斥。
- 图像 URL 支持公网 HTTP(S)、`oss://` 临时链、以及 `data:{MIME};base64,...`；网关做格式白名单校验（见 §4.3），不做像素级解码（分辨率/20MB 以上游为准，失败映射为任务 FAILED）。

#### Story 4 — 参考生视频（图 / 视频 / 音频）

> As an API 调用方, I want to 按数组顺序传入参考图、视频、音频, so that prompt 里可以用「图1」「视频1」「音频1」指代素材。

**Acceptance Criteria**

- `type`：`reference_image`（≤10）、`reference_video`（≤5）、`reference_audio`（≤5）。
- 计数规则与上游一致：**按类型分别计数**（第一个 `reference_image` = 图1，第一个 `reference_video` = 视频1），与数组下标无关。
- Playground 在参考模式下展示当前图/视频/音频序号，帮助用户写 prompt。
- 参考视频/音频总时长上限 15 秒：网关 **MVP 不解析媒体时长**，超限由上游 FAILED 返回；Playground 对本地选择的文件可做可选时长提示（非阻断，除非浏览器能读到 duration）。
- 不得与 first/last frame 混用。

#### Story 5 — 文件 / 网页参考生视频

> As an API 调用方, I want to 传入一个 file 或一个公开网页 link, so that 模型根据文档或页面生成视频。

**Acceptance Criteria**

- `file` 与 `link` 均最多 1 个，且二者互斥。
- 可与 prompt 同时存在；可与 `reference_*` 同时存在（上游允许参考模式里带 file/link 时以实现时对照官方；**若官方禁止混用，网关按官方互斥表拒绝**）。当前文档：`reference_xx` / `file` / `link` 与 `first_frame` / `last_frame` 互斥；`file` 与 `link` 互斥。
- file 扩展名白名单：`docx, doc, xlsx, xls, pptx, ppt, pdf, txt, key, pages, numbers, md`。
- link 必须是 http(s) 公网 URL。
- Playground：文件模式提供 URL 输入（MVP **不强制做网关文件上传转存**；若项目已有临时上传能力可复用，作为增强而非本 PRD 阻塞项）。

#### Story 6 — Playground Video 参数适配

> As a Playground 用户, I want to 选择 wan3.0 模型后看到专用表单, so that 不必了解上游 JSON。

**Acceptance Criteria**

- 模型目录 tag 含 `t2v` 且模型名为 `wan3.0-video` 或 `wan3.0-video-prime`（或 `wan3.0-video*` 前缀）时，profile = `wan30_video`。
- **生成模式**（单选，切换时清空不兼容媒体，避免互斥字段残留）：
  1. 文生视频
  2. 首帧生视频
  3. 首尾帧生视频
  4. 参考生视频
  5. 文件生视频
  6. 网页链接生视频
- 公共参数控件：

  | 控件 | 取值 | 默认 | 备注 |
  |------|------|------|------|
  | Resolution | `480P` / `720P` / `1080P` | `1080P` | 与上游一致，计费 size 键用大写 `P` |
  | Ratio | `adaptive` / `16:9` / `4:3` / `1:1` / `3:4` / `9:16` | `adaptive` | |
  | Duration | 整数 2–30，另可选「智能时长」 | 5 | 智能时长见 Story 7 |
  | Audio | 开/关 | 开 | `true` 输出含声音 |
  | Prompt extend | 开/关 | 开 | |
  | Watermark | 开/关 | 关 | |
  | Seed | 空或 0–2147483647 | 空（不传） | |

- 媒体输入：URL 粘贴 + 现有图片/视频拖放（参考图/首帧/尾帧走 image；参考视频走 video）。音频、文件 MVP 以 URL 为主。
- 提交 payload 走现有 `POST /v1/video/generations`，`metadata` 携带 adaptor 所需的 `ratio` / `audio` / `prompt_extend` / `watermark` / `seed` / `media`（字段名与 adaptor 约定见 §4.2）。
- 文案全部 i18n（en 为 key，补齐 zh / zh-TW / fr / ru / ja / vi）。
- 任务队列展示 profile 标签「Wan 3.0」。

#### Story 7 — 时长与智能时长的计费安全

> As a 计费系统, I want duration 永远是非负、有上界的乘数, so that 预扣不会变成负数或无界配额。

**Acceptance Criteria**

- 无参考视频时：用户时长 ∈ **[2, 30]**。
- 有 `reference_video` 时：文档约束为「输入视频总时长 + 输出时长 ≤ 30」。网关 MVP **不解析输入视频秒数**；仍限制请求 `duration ∈ [2, 30]`。超限由上游失败，预扣按请求 duration 发生，失败后退款（与现有任务失败退款一致）。
- **`duration = -1`（智能时长）**：
  - Playground：可选「Auto / 智能时长」。
  - 预扣 **按 30 秒 × 当前 resolution 档单价**（饱和上界），不得把 `-1` 写入 `OtherRatios["seconds"]`。
  - 任务成功且 usage 含 `output_video_duration` 时，**按实际上游输出时长结算差额**（多退少补，且实际时长钳制在 [1, 30]）。若现有任务结算管线尚不支持按时长回写，则本迭代 **API 与 Playground 均禁止 -1**，只允许 [2, 30]；PRD 将「智能时长结算」列为 v1.1。
- 现有 `seconds < 0` 的全局校验必须为 Wan 3.0 开白名单或改为「允许 -1 且走 30s 预扣」；**禁止**让 `-1` 穿过 `EstimateBilling` 变成负收费。
- `audio` 开关价格相同：不计额外倍率。
- 分辨率写入计费 size：`480P` / `720P` / `1080P`（与 `per_duration` 配置键一致）。

#### Story 8 — 任务查询与失败展示

> As a 用户, I want 任务失败时看到上游错误原因, so that 能改正互斥媒体或地域配置。

**Acceptance Criteria**

- 状态映射：`PENDING`→queued，`RUNNING`→in_progress，`SUCCEEDED`→completed（带 `video_url`），`FAILED`/`CANCELED`/`UNKNOWN`→failed。
- `UNKNOWN`（task_id 超 24h）展示为失败，文案说明任务已过期。
- 创建接口缺 `X-DashScope-Async` 的问题由 adaptor **始终设置**，用户无感知。
- Playground 失败态展示 `code` + `message`（来自创建响应或查询 `output`）。

### Non-Goals

- 不实现上游「异步任务回调 URL」；继续用网关已有轮询。
- 不实现批量查询 / 取消任务管理台（官方另有管理接口）。
- 不把视频结果转存到自有 OSS（文档建议 24h 内下载；可后续做持久化）。
- 不支持同步调用。
- 不把万相 3.0 接到 Chat / Image playground。
- 不在本需求中重做万相 2.x Ali 通道。
- 不保证跨地域自动改写 Endpoint。
- Playground MVP 不做本地文件直传百炼 OSS；用户需提供可访问 URL 或已有上传能力产出的 URL。

---

## 3. AI System Requirements

### Tool / Upstream Requirements

| 项 | 要求 |
|----|------|
| 模型 | `wan3.0-video`（标准）、`wan3.0-video-prime`（高速，能力对齐） |
| 创建 | `POST /api/v1/services/aigc/video-generation/video-synthesis` |
| 查询 | `GET /api/v1/tasks/{task_id}` |
| Headers | `Content-Type: application/json`，`Authorization: Bearer {key}`，创建时 `X-DashScope-Async: enable` |
| 输出 | 30fps；成功 `video_url` 约 24h 有效 |
| 地域 | 模型、Endpoint、API Key 必须同一地域 |

### Evaluation Strategy

- **契约测试（必做）**：用固定 fixture 断言 adaptor 产出的 JSON（文生、首帧、首尾帧、参考图+视频、file、link、互斥拒绝、duration -1 预扣秒数）。
- **参数边界**：prompt 空且 media 空 → 400；duration 1 或 31 → 400；seed 越界 → 400。
- **计费**：`480P/5s` 与 `1080P/5s` 预扣比等于管理员配置的 per_duration 价比；`-1` 预扣等于 30s 同档（若本迭代启用）。
- **手动验收**：北京地域真实 Key 跑通文生 5s 480P；Playground 首帧模式提交并播放。
- **不测**：上游画质、prompt 改写文案质量、生成耗时 SLA。

---

## 4. Technical Specifications

### 4.1 Architecture Overview

```
Playground Video 或 API 客户端
    → POST /v1/video/generations  (TaskSubmitReq)
    → 渠道选择（模型映射到 ChannelType 963）
    → Wan30 TaskAdaptor
         Validate（模式互斥、时长、模型名）
         EstimateBilling（seconds、resolution size）
         Pre-consume
         POST video-synthesis
         持久化 upstream task_id
    → 轮询 GET /api/v1/tasks/{id}
    → SUCCEEDED：记录 video_url；按需按时长结算
    → FAILED：退预扣，展示错误
```

创建与查询的 Base URL **原样使用渠道配置**（已含 WorkspaceId 与地域），路径与现有 Ali 视频 adaptor 相同，仅 host 不同。

### 4.2 网关请求契约（TaskSubmitReq）

保持顶层字段与现有视频任务一致，避免为 3.0 再做一个公开 API：

| 网关字段 | 映射到上游 |
|----------|------------|
| `model` | `model` |
| `prompt` | `input.prompt` |
| `size` 或 `resolution` | `parameters.resolution`（规范化为 `480P`/`720P`/`1080P`） |
| `duration` | `parameters.duration`（-1 仅在启用智能时长时原样上传） |
| `metadata.ratio` | `parameters.ratio` |
| `metadata.audio` | `parameters.audio`（指针 bool，显式 false 必须发出） |
| `metadata.prompt_extend` | `parameters.prompt_extend`（指针 bool） |
| `metadata.watermark` | `parameters.watermark`（指针 bool） |
| `metadata.seed` | `parameters.seed`（有值才发） |
| `metadata.media` | `input.media`：`[{ "type", "url" }]` |

也允许 `metadata.input.media` 作为别名（与万相 2.7 元数据习惯对齐）；两者同时存在时 **400**。

`parameters` 缺省：resolution=`1080P`，ratio=`adaptive`，duration=`5`，audio=`true`，prompt_extend=`true`，watermark=`false`。

**禁止**用 `bool` + `omitempty` 传递 `prompt_extend`/`audio`/`watermark`：`false` 会被丢掉，上游会回到默认 `true`。

Playground 构建器必须把上述 metadata 打进 `/v1/video/generations` body，并与后端 capabilities 声明的 fields 一致。

### 4.3 媒体校验（提交时，同步 400）

`type` 枚举仅允许：

`first_frame` | `last_frame` | `reference_image` | `reference_video` | `reference_audio` | `file` | `link`

分组：

- **Frame 模式**：仅 first/last frame。
- **Reference 模式**：仅 reference_*，以及可选的至多一个 file **或** 一个 link（若实现时官方样例未混用，则 file/link 作为独立模式，不与 reference_* 混用——**以互斥表为准：file/link 与 first/last 互斥；file 与 link 互斥**）。
- `prompt` 与 `media` 至少其一非空。

数量上限：first_frame≤1，last_frame≤1，reference_image≤10，reference_video≤5，reference_audio≤5，file≤1，link≤1。

URL：非空；`link`/`http(s)` 必须可解析为 URL；Base64 图像仅允许 image MIME。视频扩展名建议 `mp4`/`mov`；音频 `wav`/`mp3`（提示性校验，非加密保证）。

### 4.4 Channel 与模块

- 新 channel ID：**963**（`ChannelTypeWan30Video`），名称 `Wan 3.0 Video`。
- 注册：`GetTaskAdaptor`、任务 platform 字符串 `"963"`、endpoint 类型为视频任务、模型列表接口返回 3.0 模型、前端 `CHANNEL_TYPES` / 显示顺序 / `channel-type-config`。
- 独立 task 包，**不要**把 3.0 分支堆进 Ali 2.x `convertToAliRequest`。可复用：异步头、FetchTask 路径、`task_status` 映射、OpenAI Video 状态转换。
- 查询 RPS：遵循上游默认 20；网关沿用现有任务轮询间隔，不因文档「建议 15 秒」而改全局轮询（除非压测证明打满 RPS）。

### 4.5 计费

- 定价模式：现有 **`per_duration`**（size → $/秒 × duration）。
- size 键：`480P` / `720P` / `1080P`。
- `EstimateBilling` 的 `seconds`：正常为请求 duration（钳制到 [2, 30]）；智能时长为 **30**。
- 乘数经 `PriceData.AddOtherRatio`，禁止非正、NaN、Inf。
- 配额转换走 `common/quota_math.go` 的 Checked 辅助，饱和写入任务日志 `admin_info`。
- usage 中的 `SR`、`ratio`、`fps` 可写入任务 metadata 供日志展示，**MVP 不按 SR 二次计价**（预扣已按请求 resolution）。

### 4.6 Playground 目录

- `VideoRequestProfile`：`wan3.0-video` 前缀 → `wan30_video`。
- capabilities 示例：

```json
{
  "form": "wan30_video",
  "supported_resolutions": ["480P", "720P", "1080P"],
  "supported_ratios": ["adaptive", "16:9", "4:3", "1:1", "3:4", "9:16"],
  "duration_range": [2, 30],
  "smart_duration": true,
  "media_types": ["first_frame", "last_frame", "reference_image", "reference_video", "reference_audio", "file", "link"],
  "fields": ["resolution", "ratio", "duration", "audio", "prompt_extend", "watermark", "seed", "media"]
}
```

- 若 `smart_duration` 因结算未就绪为 false，则 UI 隐藏「智能时长」。
- 目录模型需 `t2v` tag，否则 Video 页不出现。

### 4.7 Security & Privacy

- API Key 仅存在渠道密钥存储，Playground 继续用用户 Token 调网关，不把百炼 Key 下发浏览器。
- 媒体 URL 可能含签名 OSS；日志中对 query string 做脱敏（与现有 URL 日志策略一致）。
- Base64 图像可能很大：对请求体大小走现有 HTTP 限制；超限 413/400，避免打满内存。
- `link` 类型会让上游去抓取用户指定网页：仅转发 URL，网关不做 SSRF 代抓；风险由上游承担。仍应拒绝明显的非 http(s) scheme。

### 4.8 备选方案（已评估）

| 方案 | 结论 |
|------|------|
| A. 扩展 Ali channel 17，用模型名前缀分流 | 否。Base URL、时长、媒体互斥、Playground profile 都与 2.x 冲突，回归面大。 |
| B. 新 channel 963 + 独立 adaptor（本 PRD） | 是。与 HappyHorse/Agnes 先例一致，地域 URL 由管理员配置。 |
| C. 新公开 REST 直接暴露百炼 JSON | 否。破坏统一 `/v1/video/generations` 与计费/轮询。 |

---

## 5. Risks & Roadmap

### Phased Rollout

**MVP（本 PRD）**

- Channel 963 + 创建/轮询 + 六种生成模式校验
- Playground `wan30_video` 表单（URL 为主）
- per_duration 预扣；智能时长：有结算则 30s 预扣 + 实际回写，否则不做

**v1.1**

- 智能时长结算（若 MVP 砍掉）
- Playground 本地上传 → 临时 URL
- 参考视频时长前置校验
- 消费日志展示 `orig_prompt` / usage.SR / ratio

**v2**

- 结果转存自有存储
- 上游回调替代轮询
- 多地域渠道模板一键填充 WorkspaceId

### Technical Risks

| 风险 | 缓解 |
|------|------|
| 管理员用错地域或未替换 WorkspaceId | 渠道页强提示；失败信息透出上游 `code`/`message` |
| `duration=-1` 击穿全局 seconds 校验或负计费 | 专项测试；预扣上限 30s |
| `omitempty` 丢掉 `false` | 全部可选标量用指针 |
| 24h 后 video_url / task_id 失效 | UI 提示及时下载；UNKNOWN 当失败 |
| 生成 1–5 分钟，用户重复提交 | 沿用 Playground「未完成任务再提交」确认；文档写明勿重复创建 |
| 与 wan2.7 `input.media` 字段同名不同语义（如 driving_audio vs reference_audio） | 独立 adaptor，禁止复用 2.7 normalize 函数 |

---

## 6. Testing Decisions

好的测试只锁 **对外契约与计费不变量**，不锁私有函数名或文件布局。

| 模块 | 测什么 |
|------|--------|
| Wan30 adaptor 转换 | 六种合法 body 与官方字段一致；互斥与数量上限 400 |
| 计费 EstimateBilling | 480P/720P/1080P × duration；-1 → seconds=30（若启用） |
| Playground `build-video-request` | profile 识别、metadata 形状、模式切换不带上互斥 media |
| `GetTaskAdaptor(963)` | 非空且与 Ali/HappyHorse 不同实例类型 |
| 回归 | Ali wan2.7-i2v、HappyHorse、Agnes 现有 adaptor/playground 测试全绿 |

禁止：随机 fuzz、sleep 等轮询、只打日志的测试、把错误上游语义写进生产代码仅为了过测试。

---

## 7. Open Questions（实现前可默认如下）

1. **智能时长**：默认 **MVP 不做 -1**，Playground 时长滑条 2–30；若结算管线已能按任务结果改 duration，再打开 Auto。
2. **file 与 reference_* 能否同请求**：默认 **Playground 分成独立模式、API 允许官方未禁止的组合**；若联调失败再收紧为互斥。
3. **Channel 展示名**：英文 `Wan 3.0 Video`，中文「万相 3.0 视频」。
4. **模型映射**：允许渠道把对外名映射到 `wan3.0-video-prime`；metadata 不得改 model（与 Ali 一致）。

---

## 8. Further Notes

- 上游创建成功后 **不要自动重试创建**（会重复计费与排队）；只轮询同一 `task_id`。
- 输出固定 30fps，网关不暴露 fps 参数。
- 开关声音价格相同，UI 需避免暗示关音频会更便宜。
- 保护项目标识（new-api / QuantumNous）的既有规则不变；本需求只增加渠道名与模型名。
