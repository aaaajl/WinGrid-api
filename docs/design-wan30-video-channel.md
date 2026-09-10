# 详细设计：万相 3.0 视频生成（ChannelTypeWan30Video）

> 状态：待开发  
> 日期：2026-08-25  
> 需求：[PRD：万相 3.0 视频生成](./prd-wan30-video-channel.md)  
> 参考实现：`relay/channel/task/ali`（万相 2.x）、`relay/channel/task/happyhorse`（DashScope 异步 + Playground profile）、`docs/design-agnes-video-channel.md`（高位渠道类型注册）  
> 上游：百炼 MaaS `video-synthesis` 异步 HTTP（创建 + `GET /api/v1/tasks/{task_id}`）

---

## 0. 可行性结论

**可行，按新渠道类型落地。**

万相 3.0 与现网 Ali（type=17）同属 DashScope 异步视频，但 **host、模型、媒体协议、参数面、时长上界** 均不同。扩展 Ali adaptor 会把 2.x 的 `img_url` / `wan2.7-i2v` normalize 与 3.0 的 typed `media` 缠在一起。HappyHorse（961）已证明：高位 ID + 独立 task 包 + Playground 专用 profile 可在不改 `/v1/video/generations` 的前提下接入新厂商协议。

| 维度 | 评估 |
|------|------|
| 技术可行性 | 高：复用 TaskAdaptor、轮询、OpenAI Video 对外契约、`per_duration` |
| 业务必要性 | 高：3.0 无法用 2.x 渠道正确表达 Workspace 地域与互斥媒体 |
| 实现成本 | 中：后端 adaptor + 注册约 8–12 文件；Playground 表单约 6–8 文件 |
| 迁移风险 | 低：无存量 3.0 渠道；不改 Ali 17 |
| 替代方案 | 在 Ali 内按模型前缀分流 —— 否决（见 PRD §4.8） |

**本设计锁定的 PRD 开放项：**

| 开放项 | 实现结论（MVP） |
|--------|-----------------|
| 智能时长 `duration=-1` | **不做**。Adaptor 与 Playground 只接受 `[2, 30]`。全局 `validateTaskDurationBounds` 已拒绝负数，无需开白名单。 |
| `file` 与 `reference_*` 同请求 | **API 按官方互斥表**：仅禁止 frame 组 vs 其余组、以及 `file` vs `link`。允许 `reference_*` + 至多一个 `file` **或** `link`。Playground 仍拆成独立模式，不发出混合包。 |
| Channel 名 | 英文 key `Wan 3.0 Video`；中文翻译「万相 3.0 视频」 |
| 模型映射 | 允许渠道 mapping；`metadata` **不得**改 `model` |

---

## 1. 问题与背景

### 1.1 现状

```text
Client / Playground Video
  POST /v1/video/generations
       │
       ▼
  Distribute → Channel type
       │
       ├─ 17 Ali          → task/ali          （wan2.x，dashscope.aliyuncs.com）
       ├─ 961 HappyHorse  → task/happyhorse
       ├─ 962 Agnes Video → task/agensvideo
       └─ 无 3.0 类型     → 无法路由 wan3.0-video
```

Playground 按模型名前缀选 profile。`wan3.0-video` 会落入 `generic`（仅 prompt/size/duration），发不出 `media[]` / `ratio` / `audio`。

### 1.2 与万相 2.x / HappyHorse 的差距

| 能力 | Ali 2.x | HappyHorse | 万相 3.0 |
|------|---------|------------|----------|
| Host | `dashscope.aliyuncs.com` | 同左 | `{WorkspaceId}.{region}.maas.aliyuncs.com` |
| 模型 | `wan2.*` / `wanx2.*` | `happyhorse-*` | `wan3.0-video` / `wan3.0-video-prime` |
| 媒体 | 旧字段或 2.7 `first_frame` + `driving_audio` | 另一套 media shape | typed `media[]`：frame / reference_* / file / link |
| 时长 | 约 3–10s 量级 | 2–15 | **2–30**（官方另有 -1，本 MVP 不做） |
| 比例 | size 像素串或 resolution | resolution | `ratio`：`adaptive` 与固定比 |
| 音频开关 | wan2.5 `audio` | 无对等 | `parameters.audio` 默认 true |

**禁止**复用 `normalizeWan27I2VInput`：2.7 的 `driving_audio` 与 3.0 的 `reference_audio` 不是同一 type。

---

## 2. 目标与非目标

### 2.1 目标

1. 注册 `ChannelTypeWan30Video = 963`，独立 `relay/channel/task/wan30video`。
2. 创建 / 轮询对齐官方异步两步；成功结果写入 `metadata.url`（上游 `video_url`），Playground 可播。
3. 提交前校验媒体互斥、数量、时长、prompt 长度；非法 **400** 且不调上游、不预扣。
4. Playground Video 增加 `wan30_video` 表单与六种生成模式。
5. 计费走现有 `per_duration`（及 ratio 路径的 `OtherRatios["seconds"]`）；时长乘数恒为 **2–30 的正整数**。
6. Ali / HappyHorse / Agnes / Seedance 零回归。

### 2.2 非目标（对齐 PRD）

- 智能时长、上游回调、结果转存 OSS、取消/批量任务台  
- Chat / Image playground  
- 网关代抓 `link`、解析参考视频秒数、本地上传转百炼 OSS  
- 改万相 2.x Ali 通道  

---

## 3. 总体架构

```text
Playground Video / API Client
        POST /v1/video/generations   (TaskSubmitReq)
        GET  /v1/videos/:public_id
        GET  /v1/videos/:public_id/content
                    │
                    ▼
         TokenAuth → Distribute
                    │
                    ▼
      platform = "963"  (ChannelTypeWan30Video)
                    │
                    ▼
            wan30video.TaskAdaptor
         ┌──────────┼──────────┐
         ▼          ▼          ▼
      Create     Poll       Convert
      POST .../video-synthesis
      X-DashScope-Async: enable
                    │
                    ▼
           model.Task platform=963
           UpstreamTaskID = 上游 task_id
           ResultURL = output.video_url
                    │
                    ▼
         VideoProxy default：直拉 CDN
         （不要加入 OpenAI/Sora /content 分支）
```

### 3.1 分层落点

| 层 | 位置 | 职责 |
|----|------|------|
| Constant | `constant/channel.go` | type=963、Names；BaseURL extras 可为空 |
| Endpoint | `common/endpoint_type.go` | `EndpointTypeOpenAIVideo`（同 Agnes） |
| Task adaptor | `relay/channel/task/wan30video/` | 校验、转换、创建、轮询、计费估算 |
| Registry | `relay/relay_adaptor.go` | `GetTaskAdaptor` case 963 |
| 模型目录 | `controller/model.go` | `channelTypesToRegister` 追加 963 |
| Playground API | `service/playground_video.go` + `dto/playground_video.go` | profile + capabilities |
| Playground UI | `web/src/features/playground/` | 表单、构建器、草稿、队列标签 |
| Admin UI | `web/src/features/channels/` | 类型、hints、icon、i18n |
| 轮询 | `service/task_polling.go` | **不改流程**；靠 adaptor `FetchTask`/`ParseTaskResult` |
| Proxy | `controller/video_proxy.go` | **不改**；走 default CDN |

`ChannelType2APIType` **不**为 963 增加映射，模型列表走 task adaptor（与 HappyHorse/Agnes 相同）。

`InitTask` **不必**把 963 加入 Agnes/Gemini 那种「单 key 也持久化」名单；multi-key 已有通用逻辑。与 HappyHorse 一致。

`tryRealtimeFetch` **不必**加入 963（那是 Gemini/Vertex/Agnes 查状态用）。万相结果靠后台轮询写库即可。

---

## 4. 协议映射

### 4.1 上游 HTTP

**创建**

```http
POST {ChannelBaseUrl}/api/v1/services/aigc/video-generation/video-synthesis
Authorization: Bearer {api_key}
Content-Type: application/json
X-DashScope-Async: enable
```

`ChannelBaseUrl` 必须已含 scheme + host（管理员填入 WorkspaceId 与地域），adaptor **只做路径拼接**，不拼接 WorkspaceId。

实现时 `strings.TrimRight(baseURL, "/")` 再拼接，避免双斜杠。

**查询**

```http
GET {ChannelBaseUrl}/api/v1/tasks/{upstream_task_id}
Authorization: Bearer {api_key}
```

与 Ali `FetchTask` 相同。轮询间隔沿用全局任务轮询，不改为 15s。

### 4.2 网关 TaskSubmitReq → 上游 body

顶层仍用现有任务 JSON，不新增公开路径。

| 网关 | 上游 | 规则 |
|------|------|------|
| `model` | `model` | mapping 后用 `UpstreamModelName`；禁止 metadata 改 model |
| `prompt` | `input.prompt` | trim；空且无 media → 400；`len([]rune)` 或按字节？**按 Unicode 字符数（range string）> 20000 → 400** |
| `size` / `resolution` | `parameters.resolution` | 规范化 `480P`/`720P`/`1080P`；缺省 **1080P** |
| `duration` | `parameters.duration` | 缺省 **5**；必须 ∈ [2,30] |
| `metadata.ratio` | `parameters.ratio` | 缺省 `adaptive`；枚举见下 |
| `metadata.audio` | `parameters.audio` | `*bool`，缺省 true |
| `metadata.prompt_extend` | `parameters.prompt_extend` | `*bool`，缺省 true |
| `metadata.watermark` | `parameters.watermark` | `*bool`，缺省 false |
| `metadata.seed` | `parameters.seed` | 仅当提供；∈ [0, 2147483647] |
| `metadata.media` | `input.media` | 见 §4.4 |
| `metadata.input.media` | 同上别名 | 与 `metadata.media` 同时存在 → 400 |

**禁止**像 Ali 那样把整份 metadata unmarshal 到含 `model` 的请求结构。使用独立 `Wan30Metadata`（HappyHorse 模式）。

**禁止** `bool` + `json:",omitempty"` 传 `audio` / `prompt_extend` / `watermark`。参数结构：

```go
type Wan30Parameters struct {
    Resolution   string `json:"resolution,omitempty"`
    Ratio        string `json:"ratio,omitempty"`
    Duration     int    `json:"duration"` // 始终发出 2–30，不用 omitempty
    Audio        *bool  `json:"audio,omitempty"`
    Seed         *int   `json:"seed,omitempty"`
    PromptExtend *bool  `json:"prompt_extend,omitempty"`
    Watermark    *bool  `json:"watermark,omitempty"`
}
```

`Duration` 用非指针且 **不用 omitempty**，保证默认 5 一定上传。`false` 的开关靠指针非 nil。

缺省指针在 convert 里显式赋值（与 HappyHorse `PromptExtend: &promptExtend` 相同）。

### 4.3 合法上游 body 示例（契约测试金样）

文生：

```json
{
  "model": "wan3.0-video",
  "input": { "prompt": "一只小猫在月光下奔跑" },
  "parameters": {
    "resolution": "480P",
    "ratio": "adaptive",
    "duration": 5,
    "audio": true,
    "prompt_extend": true,
    "watermark": false
  }
}
```

首帧：`input.media = [{ "type": "first_frame", "url": "https://..." }]`

首尾帧：再追加 `{ "type": "last_frame", "url": "..." }`

参考：`type` 为 `reference_image` / `reference_video` / `reference_audio`，顺序与客户端数组一致。

文件：`{ "type": "file", "url": "https://.../deck.pptx" }`

网页：`{ "type": "link", "url": "https://..." }`

### 4.4 媒体校验（Validate，同步 400）

`type` 白名单：

`first_frame` | `last_frame` | `reference_image` | `reference_video` | `reference_audio` | `file` | `link`

定义两组：

- **Frame**：`first_frame`, `last_frame`
- **Rest**：`reference_image`, `reference_video`, `reference_audio`, `file`, `link`

规则（失败均 `invalid_media`，HTTP 400，`LocalError=true`）：

1. 每项 `type`、`url` 去空格后非空。  
2. Frame 与 Rest **不得共现**。  
3. `file` 与 `link` **不得共现**。  
4. `last_frame` 出现则必须有恰好 1 个 `first_frame`。  
5. 计数：first_frame≤1，last_frame≤1，reference_image≤10，reference_video≤5，reference_audio≤5，file≤1，link≤1。  
6. `prompt` 与 `media` 不能同时为空。  
7. `link` 的 url 必须 `http://` 或 `https://`（`url.Parse` + scheme 检查）。`oss://` 允许用于非 link 类型。  
8. `first_frame` / `last_frame` / `reference_image`：url 为 `data:` 时 MIME 必须是 `image/jpeg|jpg|png|bmp|webp`（jpg 视为 jpeg）。  
9. `file`：路径/URL 扩展名 ∈ `{docx,doc,xlsx,xls,pptx,ppt,pdf,txt,key,pages,numbers,md}`（大小写不敏感；query 去掉后再取 ext）。  
10. `reference_video` 扩展名提示校验 `mp4`/`mov`；`reference_audio` 为 `wav`/`mp3`。不匹配仍 **400**（比「只提示」更严，避免明显错类型打到上游计费）。无扩展名的签名 URL **放行**（只靠 type）。  

不做：下载文件、解码分辨率、累计参考视频秒数。

### 4.5 其它校验

| 字段 | 规则 |
|------|------|
| 上游模型 | `wan3.0-video` 或 `wan3.0-video-prime`，或 `strings.HasPrefix(..., "wan3.0-video")`（允许后缀）。其它 → 400 `unsupported_model` |
| resolution | 仅 `480P`/`720P`/`1080P`（输入 `1080p`/`1080` 规范化） |
| ratio | `adaptive`,`16:9`,`4:3`,`1:1`,`3:4`,`9:16` |
| duration | 缺省 5；∈ [2,30]；**拒绝 -1**（`invalid_duration`） |
| seed | 可选；越界 400 |

Validate 成功后把规范化的 `Size`、`Duration` **写回 context 中的 TaskSubmitReq**，保证 `per_duration` 的 `ResolveTaskBillingDuration` / `ResolveTaskBillingSize` 读到正数与 `1080P` 键。缺 duration 且走 per_duration 时，若不写回会出现「duration is required」。

### 4.6 响应与状态

创建成功体：

```json
{ "output": { "task_status": "PENDING", "task_id": "..." }, "request_id": "..." }
```

`DoResponse`：`Code != ""` → 任务错误；`task_id` 空 → 错误。返回公开 `PublicTaskID`，内部 `UpstreamTaskID=output.task_id`。`Task.Data` 存原始 JSON。

查询成功（节选）：`output.video_url`、`task_status`、`usage`。

`ParseTaskResult`：

| 上游 `task_status` | `model.TaskStatus` | 额外 |
|--------------------|--------------------|------|
| PENDING | Queued | |
| RUNNING | InProgress | |
| SUCCEEDED | Success | `Url = video_url` |
| FAILED / CANCELED / UNKNOWN | Failure | Reason=`output.message` 或顶层 `message`；UNKNOWN 文案含 expired/unknown |

`ConvertToOpenAIVideo`：对齐 HappyHorse/Ali，**不要**透传原始 JSON。

- `id` = 公开 task_id  
- `status`：PENDING→queued，RUNNING→in_progress，SUCCEEDED→completed，其余 failed  
- `SetMetadata("url", video_url 或 GetResultURL())`  
- 错误写入 `OpenAIVideoError`

Playground `use-video-task.ts` 已读 `metadata.url`，无需改轮询 URL 逻辑。

### 4.7 用量字段（日志，不计二次价）

成功查询的 `usage`（`duration`/`output_video_duration`/`SR`/`ratio`/`fps`）可在 `ConvertToOpenAIVideo` 或 Parse 时写入 metadata 供展示。MVP **不**用 `AdjustBillingOnComplete` 按实际秒数改配额（因为不做 -1，预扣秒数即用户秒数）。`BaseBilling` 默认 complete=0 即可。

---

## 5. 计费

### 5.1 运营配置

模型定价模式选 **按时长 `per_duration`**，size 键：

| size | 含义 |
|------|------|
| `480P` | 480 档 |
| `720P` | 720 档 |
| `1080P` | 1080 档（缺省） |

`NormalizeSizeKey` 已把大小写/`p` 后缀归一；adaptor 仍应先规范成大写 `P` 再写回 `req.Size`。

未配 `duration_pricing` 时走既有报错，不在 adaptor 里写死单价。

### 5.2 EstimateBilling

在 convert 之后（或与 convert 共用 normalize 结果）：

```text
OtherRatios["seconds"] = float64(duration)   // 2–30，经 AddOtherRatio
```

可选：若运营仍用 ModelRatio × OtherRatios，可再加 `resolution-480P` 等键；**不要**复制 Ali 2.x 那张写死模型倍率表。3.0 以 `per_duration` 为主。

`audio` 不参与倍率。

配额转换：若本 adaptor 自己算 quota，必须用 `common.QuotaFromFloatChecked` 等；当前任务主路径是 helper `modelPriceHelperPerDuration` + `QuotaFromFloatStrict`，adaptor 只需保证 Duration/Size 已规范化。

### 5.3 与全局校验的关系

`validateTaskDurationBounds`：`seconds < 0` 拒绝。MVP 用户不会传 -1。`seconds==0` 放行，由 adaptor 填 5。

`MaxTaskDurationSeconds=3600` 宽于 3.0 的 30；**30 的上界必须在 963 adaptor 内强制**，否则 per_duration 会按用户填的 120s 预扣。

---

## 6. Playground

### 6.1 Profile 识别

后端 `service.VideoRequestProfile` 与前端 `getVideoRequestProfile` **同一规则**：

```text
strings.HasPrefix(strings.ToLower(modelName), "wan3.0-video") → "wan30_video"
```

覆盖 `wan3.0-video`、`wan3.0-video-prime`。

模型目录必须带 tag `t2v`，否则 ListPlaygroundVideoModels 不会返回。

**关键：** `web/src/features/playground/api.ts` 的 profile 白名单必须加上 `'wan30_video'`，否则前端会把目录项滤掉。

### 6.2 Capabilities

```go
type Wan30VideoCapabilities struct {
    SupportedResolutions []string `json:"supported_resolutions"`
    SupportedRatios      []string `json:"supported_ratios"`
    DurationRange        [2]int   `json:"duration_range"`
    SmartDuration        bool     `json:"smart_duration"`
    MediaTypes           []string `json:"media_types"`
    Modes                []string `json:"modes"`
    Fields               []string `json:"fields"`
    Form                 string   `json:"form"` // "wan30_video"
}
```

固定值：

- resolutions: `480P`,`720P`,`1080P`  
- ratios: `adaptive`,`16:9`,`4:3`,`1:1`,`3:4`,`9:16`  
- duration_range: `[2,30]`  
- smart_duration: **false**（MVP）  
- modes: `t2v`,`first_frame`,`first_last_frame`,`reference`,`file`,`link`  
- form: `wan30_video`  

前端用 `form === 'wan30_video'` 做类型守卫（与 Agnes 相同，避免和 Seedance 的 `supported_resolutions` 冲突）。

### 6.3 表单状态

```ts
type Wan30Mode =
  | 't2v'
  | 'first_frame'
  | 'first_last_frame'
  | 'reference'
  | 'file'
  | 'link'

interface Wan30MediaItem {
  type: 'reference_image' | 'reference_video' | 'reference_audio'
  url: string
}

interface Wan30FormState {
  model: string
  prompt: string
  mode: Wan30Mode
  resolution: string
  ratio: string
  duration: number
  audio: boolean
  promptExtend: boolean
  watermark: boolean
  seed?: number
  firstFrameUrl?: string
  lastFrameUrl?: string
  references: Wan30MediaItem[]
  fileUrl?: string
  linkUrl?: string
}
```

切换 `mode` 时清空其它模式字段（保留 prompt / 公共参数）。

参考模式 UI：

- 列表可增删；每行 type 下拉 + URL（图/视频可复用 `MediaDropZone`）  
- 旁注「图 N / 视频 N / 音频 N」按 **当前列表中该 type 的出现次序** 计数（与上游一致）  
- 提交前本地校验数量上限  

文件/网页模式：单行 URL。`file` 提示支持的扩展名。

### 6.4 构建请求

```ts
function buildWan30VideoRequest(state: Wan30FormState): VideoGenerationRequest {
  const media = mediaFromMode(state) // t2v → 省略
  return {
    model: state.model,
    prompt: state.prompt.trim(),
    size: state.resolution,
    duration: state.duration,
    metadata: {
      ratio: state.ratio,
      audio: state.audio,
      prompt_extend: state.promptExtend,
      watermark: state.watermark,
      ...(state.seed != null ? { seed: state.seed } : {}),
      ...(media.length ? { media } : {}),
    },
  }
}
```

`audio`/`prompt_extend`/`watermark` **始终写入**（含 false），供后端指针反序列化。

提交前前端：t2v 要求 prompt 非空；first_frame 要求 URL；first_last_frame 要求两帧；file/link 要求对应 URL；reference 要求 prompt 或至少一条 media。

### 6.5 接入点

| 文件 | 变更 |
|------|------|
| `types.ts` | profile 联合类型 + capabilities |
| `build-video-request.ts` | profile 分支、builder、default state、type guard |
| `build-video-request.test.ts` | 金样：文生 metadata；首帧 media；互斥模式不混字段 |
| `wan30-video-fields.tsx`（新） | 模式选择 + 公共参数 + 媒体 |
| `video-input-form.tsx` | state、draft、submit 分支 |
| `ui-draft.ts` | `VideoDraft.wan30` |
| `api.ts` | 白名单 |
| `video-task-queue.tsx` / `video-task-item.tsx` | 标签 `Wan 3.0`（i18n） |
| `playground_video.go` + test | profile 与 capabilities |
| `dto/playground_video.go` | struct |

默认 duration：`Math.max(range[0], 5)`；默认 resolution：`1080P`（若在列表中）。

### 6.6 i18n

所有用户可见文案走 `t('English key')`。新增 key 至少包括：`Wan 3.0 Video`、生成模式名、Resolution、Ratio、Duration、Audio、Prompt extend、Watermark、Seed、各媒体占位符、互斥/必填错误。按 `.agents/skills/i18n-translate` 补全 7 种 locale。

---

## 7. 渠道管理 UI

| 文件 | 变更 |
|------|------|
| `constant/channel.go` | `ChannelTypeWan30Video = 963`；`ChannelTypeNames`；`channelBaseURLExtras` 可不设或 `""` |
| `web/.../channels/constants.ts` | `963: 'Wan 3.0 Video'`；`CHANNEL_TYPE_DISPLAY_ORDER` 追加 963 |
| `channel-type-config.ts` | 无 `defaultBaseUrl`（避免填成未替换的 `{WorkspaceId}`）；`icon: 'tongyi'`；hints 列出五地域 URL 模板、Key=DashScope、models=`wan3.0-video,wan3.0-video-prime` |
| `channel-utils.ts` | `963: 'Tongyi'` |
| `CHANNEL_TYPE_WARNINGS` | 提示模型、Endpoint、API Key 必须同一地域；把 `{WorkspaceId}` 换成真实业务空间 ID |

**不在保存接口强制** host 含 `.maas.aliyuncs.com`（允许自建反代）。靠 hints/warning。若 URL 仍含字面量 `{WorkspaceId}`，前端保存时可 toast 警告（非阻断可选）。

Ali type=17 的 `ModelList` **不**增加 `wan3.0-*`。

---

## 8. Adaptor 方法契约

包路径：`relay/channel/task/wan30video`

```text
Init
ValidateRequestAndSetAction
    ValidateMultipartDirect
    读 TaskSubmitReq
    解析 metadata / media
    规范化 size/duration，写回 context
    校验模型、prompt 长度、media 规则
EstimateBilling
    seconds = 规范化 duration（2–30）
    AddOtherRatio("seconds", ...)
AdjustBillingOnSubmit / OnComplete
    嵌入 taskcommon.BaseBilling（complete 返回 0）
BuildRequestURL     POST {base}/api/v1/services/aigc/video-generation/video-synthesis
BuildRequestHeader  Bearer + Content-Type + X-DashScope-Async: enable
BuildRequestBody    convert → common.Marshal（禁止 encoding/json）
DoRequest           channel.DoTaskApiRequest
DoResponse          解析 task_id；c.JSON OpenAI Video queued
FetchTask           GET {base}/api/v1/tasks/{task_id}
ParseTaskResult     状态 + Url
ConvertToOpenAIVideo
GetModelList        ["wan3.0-video", "wan3.0-video-prime"]
GetChannelName      "wan30video" 或 "Wan 3.0 Video"（与 GetChannelTypeName 区分：channel name 用短 id 亦可，OwnedBy 展示用 Names）
```

JSON 一律 `common.Marshal` / `common.Unmarshal`。

单测用 `testify/require` + `assert`。

---

## 9. 实现清单

### 9.1 P0 后端

| 项 | 说明 |
|----|------|
| `constant/channel.go` | 963 |
| `common/endpoint_type.go` | OpenAIVideo |
| `relay/channel/task/wan30video/constants.go` | ModelList、ChannelName |
| `relay/channel/task/wan30video/adaptor.go` | 全套 |
| `relay/channel/task/wan30video/validate.go`（可选拆分） | 媒体规则；若仅一处调用则内联在 adaptor，避免单调用 helper 膨胀 |
| `relay/channel/task/wan30video/adaptor_test.go` | 见 §11 |
| `relay/relay_adaptor.go` | case 963 |
| `controller/model.go` | register 963 |
| `service/playground_video.go` + `dto/playground_video.go` + tests | profile |

媒体校验函数若同时被测试与 convert 使用，可以是 **包内校验的核心契约**（多测试调用），允许独立函数。

### 9.2 P0 前端

渠道注册 + Playground 全套（§6.5、§7）+ i18n。

### 9.3 通常不改

- `router/video-router.go`  
- `common/api_type.go`  
- `controller/video_proxy.go`  
- `relay/common/relay_utils.go` 全局 duration（MVP 不放开 -1）  
- Ali `task/ali`  

### 9.4 工作量

| 阶段 | 粗估 |
|------|------|
| adaptor + 注册 + 单测 | 1.5–2.5 人日 |
| Playground 表单 + 构建器测试 | 1.5–2 人日 |
| 渠道 UI + i18n | 0.5 人日 |
| 真实 Key 联调 | 0.5 人日 |

---

## 10. 数据流（提交）

```text
ValidateMultipartDirect
        │
        ▼
wan30 Validate（400 则结束，无预扣）
        │
        ▼
EstimateBilling → OtherRatios.seconds
        │
        ▼
modelPriceHelper（per_duration 读 Duration+Size）
        │
        ▼
Pre-consume
        │
        ▼
Build body → POST video-synthesis
        │
        ├─ 上游业务错误（InvalidApiKey 等）→ 退款
        └─ task_id → 落库 → 返回公开 ID
                │
                ▼
        轮询 GET /api/v1/tasks/{id}
                │
                ├─ SUCCEEDED → ResultURL=video_url
                └─ FAILED/UNKNOWN → Failure + 退款
```

创建成功后 **禁止**自动重试 POST（重复任务 + 重复预扣）。

---

## 11. 测试计划

### 11.1 Adaptor 表驱动（必须）

转换金样：

1. 仅 prompt + 默认参数  
2. 显式 `watermark=false`,`audio=false`,`prompt_extend=false` 的 JSON **含这些键且为 false**  
3. 首帧 / 首尾帧  
4. 参考图+参考视频（prompt 含「图1」「视频1」）  
5. file、link  
6. `metadata.input.media` 别名  
7. mapping 后 model 为 prime  

拒绝：

8. prompt 与 media 皆空  
9. prompt 20001 字符  
10. first+reference 混用  
11. file+link  
12. 仅 last_frame  
13. duration 1、31、-1  
14. 非法 ratio / resolution  
15. 两份 media 字段同时存在  
16. metadata 改 model  

计费：

17. EstimateBilling：duration=10 → seconds=10  
18. 缺 duration → 写回 5 后 seconds=5  
19. Size `720p` → 写回 `720P`  

Parse/Convert：

20. PENDING/RUNNING/SUCCEEDED（含 video_url）/FAILED/UNKNOWN  
21. Convert 的 metadata.url = video_url  

Registry：

22. `GetTaskAdaptor("963")` 非 nil，且与 Ali adaptor 类型不同  

### 11.2 Playground

- `getVideoRequestProfile('wan3.0-video-prime') === 'wan30_video'`  
- `buildWan30VideoRequest` 文生无 media；首帧只有 first_frame  
- 模式切换后 payload 不含上一模式 URL  

### 11.3 回归

现有 `task/ali/adaptor_test.go`、`happyhorse`、`agensvideo`、`build-video-request.test.ts`、`playground_video_test.go` 全绿。

### 11.4 手工

1. 管理端建 type=963，BaseURL 替换真实 WorkspaceId（北京），Key 同地域。  
2. 模型 `wan3.0-video`、`wan3.0-video-prime` 进分组；目录 tag=`t2v`。  
3. 配 per_duration：480P/720P/1080P。  
4. Playground：文生 5s 480P → 可播。  
5. 首帧模式失败态能看到上游 message。  
6. API 故意混用 first_frame + reference_image → 400，渠道无新任务。  

---

## 12. 风险

| 风险 | 缓解 |
|------|------|
| `{WorkspaceId}` 未替换 / 跨地域 | 渠道 warning；透出上游 code/message |
| Base64 图撑爆 body | 现有 HTTP 体限制；超限即失败 |
| 签名 URL 无扩展名被 file/video 规则误杀 | 无扩展名放行 |
| 2.7 与 3.0 media 混淆 | 独立包，禁止 import ali 的 media normalize |
| Playground 白名单漏加 profile | 目录有模型但 Video 页空白；测试覆盖 api filter 或 profile 函数 |
| video_url 24h 过期 | UI 沿用现有「复制链接」；过期后提示重新生成 |
| 长时间生成重复提交 | 现有未完成任务确认框 |

---

## 13. 分期

| 里程碑 | 内容 | 验收 |
|--------|------|------|
| **M1** | 963 + adaptor + 渠道 UI + 契约测试 | curl `/v1/video/generations` 文生成功并可查 url |
| **M2** | Playground `wan30_video` 六模式 | 页内文生 + 首帧可播 |
| **M3** | 运营：目录 t2v、per_duration、分组切流 | 生产可用 |
| **M4**（PRD v1.1） | 智能时长 30s 预扣 + usage 结算；本地上传 | 另开需求 |

M1 与 M2 可同一迭代交付。

---

## 14. 决策摘要

| 决策项 | 结论 |
|--------|------|
| 渠道类型 | **新增** `ChannelTypeWan30Video = 963` |
| 是否改 Ali 17 | **否** |
| 包名 | `relay/channel/task/wan30video` |
| 对外 API | 保持 `/v1/video/generations` + `/v1/videos*` |
| 智能时长 | MVP **关闭** |
| 媒体互斥 | 官方表；Playground 分模式 |
| 结果 URL | 上游 `video_url` → `metadata.url`；VideoProxy default |
| 计费 | `per_duration`；adaptor 规范 Duration∈[2,30]、Size 为大写 P |
| JSON | 仅 `common.*` marshal |
| 可选 bool | 指针，保证 false 上传 |
| Playground profile | `wan30_video`，`form` 判别 |

---

## 附录 A：官方 API 速查

```text
创建: POST https://{WorkspaceId}.{region}.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis
查询: GET  https://{WorkspaceId}.{region}.maas.aliyuncs.com/api/v1/tasks/{task_id}
头:   Authorization: Bearer sk-...
      X-DashScope-Async: enable   （仅创建）
模型: wan3.0-video | wan3.0-video-prime
状态: PENDING → RUNNING → SUCCEEDED | FAILED
成功: output.video_url （约 24h）
地域: cn-beijing | ap-southeast-1 | ap-northeast-1 | eu-central-1 | us-east-1
```

## 附录 B：与 Ali / HappyHorse 对照（实现时抄什么、不抄什么）

| 抄 | 不抄 |
|----|------|
| HappyHorse：指针参数、metadata 结构、Playground profile 接线 | HappyHorse 的 media `image_url` 嵌套结构 |
| Ali：FetchTask 路径、task_status 映射、DoResponse 公开 ID | Ali `convertToAliRequest` 整包 unmarshal metadata、wan2.7 normalize、t2v 的 `size` 像素串 |
| Agnes 设计：高位 ID、endpoint OpenAIVideo、渠道 UI 清单 | Agnes 的 `/agnesapi?video_id=`、InitTask 强制存 key |

## 附录 C：网关请求最小样例

```http
POST /v1/video/generations
Authorization: Bearer {user_token}
Content-Type: application/json

{
  "model": "wan3.0-video",
  "prompt": "一只小猫在月光下的屋顶上奔跑",
  "size": "480P",
  "duration": 5,
  "metadata": {
    "ratio": "adaptive",
    "audio": true,
    "prompt_extend": true,
    "watermark": false
  }
}
```
