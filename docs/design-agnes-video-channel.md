# 详细设计：Agnes Video 专用渠道类型（ChannelTypeAgnesVideo）

> 状态：M1–M4 已落地（M3 切流见 `docs/migrate-agnes-video-m3.sql`；现网渠道 `#30 Agnes Video CN` type=62）  
> 日期：2026-08-04  
> 官方文档：[Agnes Video V2.0](https://www.agnes-ai.cn/zh-Hans/docs/agnes-video-v20)  
> 触发问题：Playground 中 `agnes-video-v2.0` 任务成功但无法预览（缺少 `metadata.url`）  
> 命名说明：官方品牌为 **Agnes**；现网渠道名存在 `AgensCN` / `AgensGlobal` 拼写。本设计常量统一为 `AgnesVideo`，展示名可用 `Agnes Video`。
>
> 实现摘要：`ChannelTypeAgnesVideo=62`、`relay/channel/task/agensvideo`、通用 `UpstreamVideoID` 提取与轮询透传；VideoProxy 走 default CDN 分支；存量 OpenAI+Sora 路径不变。

---

## 0. 可行性结论

**可行，且建议做。**

当前 `agnes-video-v2.0` 挂在 **OpenAI（type=1）** 上，走 **Sora task adaptor**。创建任务勉强能通，但轮询 / 结果 URL / 视频代理语义与 [Agnes 官方异步 API](https://www.agnes-ai.cn/zh-Hans/docs/agnes-video-v20) 不对齐，直接导致 Playground 预览失败，并埋下 multi-key、内容代理等后续风险。

新增专用 `ChannelTypeAgnesVideo`（建议 ID=`62`）是与现有 HappyHorse / DoubaoVideo / Kling 等「视频任务型渠道」同一成熟模式，改造边界清晰、可灰度迁移、不破坏对外 `/v1/videos` 契约。

| 维度 | 评估 |
|------|------|
| 技术可行性 | 高：复用 TaskAdaptor + OpenAI Video 对外契约 |
| 业务必要性 | 高：修复预览；对齐官方 `video_id` / `metadata.url` |
| 实现成本 | 中：约 15–25 文件；可分期交付 |
| 迁移风险 | 中低：存量 OpenAI 渠道任务可继续用旧路径；新渠道切流 |
| 替代方案 | 仅修 Sora `ConvertToOpenAIVideo` —— 能止血预览，但无法正确支持 `/agnesapi?video_id=`，长期仍会和真 OpenAI/Sora 行为纠缠 |

**推荐策略：** 落地专用渠道类型（本方案）+ Playground 继续读 `metadata.url`；可选补前端 blob 拉取作为鉴权增强。

---

## 1. 问题与背景

### 1.1 现状链路

```text
Client / Playground
  POST /v1/videos  (agnes-video-v2.0)
       │
       ▼
  Channel type = OpenAI (1)   ← 现网 #28 AgensCN, #26 AgensGlobal
       │
       ▼
  GetTaskAdaptor("1") → sora.TaskAdaptor
       │
       ├─ Create:  POST {base}/v1/videos          ✅ 与官方一致
       ├─ Poll:    GET  {base}/v1/videos/{id}     ⚠️ 仅旧版兼容路径
       ├─ Parse:   Url 故意留空 → ResultURL=网关 proxy
       └─ Status:  ConvertToOpenAIVideo 透传上游 JSON，不注入 metadata.url
                   → Playground 读不到 videoUrl → 无法预览
```

复现样本（本地库）：

| 字段 | 值 |
|------|-----|
| 公开 task_id | `task_OlEHwS2GSCxrCIVjKUkBxuHy2p455w17` |
| 上游 task_id | `task_H4Jimsx7MOjAuBswuizBnTw86LozIY8A` |
| Request ID 时间 | `20260803102930` UTC → 提交 `2026-08-03 18:29:30` CST |
| status | SUCCESS |
| result_url | `https://ai.wormholexyz.xyz/v1/videos/.../content`（网关代理） |
| data.metadata | **空** |

### 1.2 与官方契约的差距

依据 [Agnes Video V2.0 文档](https://www.agnes-ai.cn/zh-Hans/docs/agnes-video-v20)：

| 能力 | 官方 | 当前 Sora 路径 |
|------|------|----------------|
| 创建 | `POST /v1/videos`，返回 `task_id` + **`video_id`** | 只持久化 `id`/`task_id`，**忽略 `video_id`** |
| 推荐查询 | `GET /agnesapi?video_id=` | **未实现** |
| 兼容查询 | `GET /v1/videos/<TASK_ID>` | 仅此路径 |
| 完成结果 | `metadata.url` = CDN 直链 | 不解析；`ParseTaskResult` 留空 Url |
| 对外 status | 应对齐 OpenAI Video + `metadata.url` | 透传无 url → Playground 挂 |
| 内容获取 | 应用 CDN；或网关代理 CDN | VideoProxy 走 `{base}/v1/videos/{upstream}/content`（OpenAI/Sora 分支），对 Agnes 不合适 |

### 1.3 为何不继续挂 OpenAI 类型

1. **语义冲突**：OpenAI/Sora 成功态约定「无直链 → 用 `/content` 代理」；Agnes 成功态约定「有 CDN `metadata.url`」。
2. **轮询 ID 错误**：官方推荐 `video_id`；Sora 只存 task id。
3. **修 Sora 会影响真 Sora/OpenAI 视频渠道**（若在共用 adaptor 里特判 model 前缀，长期不可维护）。
4. **多 key**：现网 Agnes 渠道已是 multi-key；专用类型可明确 InitTask / polling / proxy 的 key 策略。

---

## 2. 目标与非目标

### 2.1 目标

1. 新增渠道类型 **`ChannelTypeAgnesVideo = 62`**，默认 BaseURL `https://api.agnes-ai.cn`（全球站可配 `https://apihub.agnes-ai.com`）。
2. 专用 TaskAdaptor：正确创建、轮询（优先 `video_id`）、解析 CDN URL、对外 status 注入 `metadata.url`。
3. Playground / 用量日志可预览成功视频（直链优先；同源 proxy 作回退）。
4. 对外 API 仍为 OpenAI-compatible：`POST/GET /v1/videos`、`GET /v1/videos/:id/content`。
5. 支持文生视频；预留图生 / 关键帧参数透传。
6. 计费可按 `seconds`（或 `num_frames/frame_rate`）接入现有 ratio / per_duration 体系。
7. 存量 OpenAI 类型上的 Agnes 渠道可平滑迁移，不强制中断历史任务。

### 2.2 非目标（本阶段不做）

- 不为 Agnes **图像**（`agnes-image-*`）改渠道类型（已有 OpenAI chat 路径 + playground `agnes_image` profile）。
- 不改造 Agnes 聊天模型 `agnes-2.5-flash`。
- 不改变对外路径前缀（不做 `/agnes/...` 对外暴露）。
- 不在本方案内做官方价格 `$0.005/s` 的自动定价同步（由运营配置 model price / duration pricing）。

---

## 3. 总体架构

```text
                    POST /v1/videos
                    GET  /v1/videos/:task_id
                    GET  /v1/videos/:task_id/content
                              │
                              ▼
                     middleware.TokenAuth
                     middleware.Distribute
                              │
                              ▼
              platform = "62" (ChannelTypeAgnesVideo)
                              │
                              ▼
                   agensvideo.TaskAdaptor
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
   Create upstream      Poll upstream        Status to client
   POST /v1/videos      GET /agnesapi?        ConvertToOpenAIVideo
   保存 upstream_id     video_id=...          metadata.url=CDN
   保存 video_id        (fallback legacy)     (+ 可选 proxy URL)
         │                    │                    │
         └────────────────────┴────────────────────┘
                              │
                              ▼
                    model.Task (platform=62)
                    PrivateData.UpstreamTaskID
                    PrivateData.ResultURL = CDN
                              │
                              ▼
              VideoProxy default 分支：直拉 CDN
              （不要走 OpenAI/Sora /content 分支）
```

### 3.1 分层落点（对齐仓库习惯）

| 层 | 路径 | 职责 |
|----|------|------|
| Constant | `constant/channel.go` | type=62、BaseURL、Names |
| Task adaptor | `relay/channel/task/agensvideo/` | 协议适配 |
| Registry | `relay/relay_adaptor.go` | `GetTaskAdaptor` case |
| Polling | `service/task_polling.go` | 通用视频轮询（无需改流程，靠 adaptor） |
| Proxy | `controller/video_proxy.go` | **保持 default 分支**（CDN） |
| Playground | `service/playground_video.go` + web | profile 可选增强 |
| Admin UI | `web/default/.../channels`（+ classic） | 渠道类型下拉 |

---

## 4. 协议映射设计

### 4.1 创建任务 `POST /v1/videos`

**上游：** `POST {base}/v1/videos`  
**鉴权：** `Authorization: Bearer {api_key}`

#### 对外请求（网关已支持的 OpenAI Video / TaskSubmit 形态）

Playground `generic` 当前发：`model` / `prompt` / `size` / `duration` 等。

#### 上游 Agnes 字段（官方）

| 上游字段 | 来源策略 |
|----------|----------|
| `model` | `UpstreamModelName`（如 `agnes-video-v2.0`） |
| `prompt` | 必填 |
| `image` | 图生视频 |
| `mode` | `ti2vid` / `keyframes` |
| `width` / `height` | 由 `size`（如 `1152x768` / `720P`）解析或透传 |
| `num_frames` / `frame_rate` | 由 `seconds`/`duration` 推导，或 metadata 透传；须满足 `≤441` 且 `8n+1` |
| `seed` / `negative_prompt` / `num_inference_steps` | metadata / Extra 透传 |
| `extra_body.image` / `extra_body.mode` | 关键帧模式 |

**参数校验（adaptor 内）：**

- `prompt` 非空  
- 若有 `num_frames`：`1 ≤ n ≤ 441` 且 `(n-1)%8==0`  
- `frame_rate` ∈ `[1,60]`（若提供）  
- 时长相关字段走现有 `MaxTaskDurationSeconds` 边界（计费安全）

**DoResponse 持久化：**

| 字段 | 存哪 |
|------|------|
| 上游 `task_id` / `id` | `PrivateData.UpstreamTaskID`（与现网一致，轮询通信用） |
| 上游 `video_id` | **新增**：建议存 `PrivateData` 扩展字段，如 `UpstreamVideoID`（见 4.4） |
| 原始响应 | `Task.Data` |
| 返回客户端 | 公开 `task_xxxx`（`PublicTaskID`），与现逻辑一致 |

### 4.2 轮询（推荐路径）

**优先：**

```http
GET {base}/agnesapi?video_id={UpstreamVideoID}
Authorization: Bearer {key}
```

可选：`&model_name=agnes-video-v2.0`（当 video_id 为上游原始 ID 或非默认模型时）。

**回退：**

```http
GET {base}/v1/videos/{UpstreamTaskID}
```

当 `UpstreamVideoID` 为空（历史任务 / 上游未返回）时使用。

### 4.3 解析成功结果

官方完成响应关键字段：

```json
{
  "status": "completed",
  "progress": 100,
  "metadata": {
    "url": "https://platform-outputs.agnes-ai.space/videos/....mp4",
    "size_mapping": { ... }
  }
}
```

`ParseTaskResult` 必须：

| 上游 status | TaskStatus | 额外动作 |
|-------------|------------|----------|
| `queued` / `pending` | Queued | |
| `in_progress` / `processing` | InProgress | |
| `completed` | Success | `Url = metadata.url`（CDN） |
| `failed` / `cancelled` | Failure | `Reason` from error |

轮询框架在 Success 时：

- `PrivateData.ResultURL = CDN url`（非 proxy）  
- 若 CDN 为空，再回退 `BuildProxyURL(publicTaskID)`（防御）

### 4.4 PrivateData 扩展（建议）

在 `model.TaskPrivateData` 增加：

```go
UpstreamVideoID string `json:"upstream_video_id,omitempty"`
```

- 提交时写入  
- `FetchTask` 优先使用  
- 旧任务无该字段 → 走 legacy `/v1/videos/{UpstreamTaskID}`

不建议复用 `UpstreamTaskID` 混存 video_id（二者官方语义不同，且可能同值也可能不同）。

### 4.5 对外 ConvertToOpenAIVideo

**禁止**照搬 Sora「原样透传」。应对齐 HappyHorse / `task.ToOpenAIVideo()`：

```text
id          = 公开 task_id
status      = queued|in_progress|completed|failed
progress    = ...
model       = OriginModelName
metadata.url = GetResultURL()   // 优先 CDN
// 可选：保留 size / seconds / size_mapping 等从 Data 回填
```

这样 Playground `res.metadata?.url` 立刻可用；CDN 一般为公网可播直链，`<video src>` 无需 Bearer。

---

## 5. VideoProxy 策略

| 渠道类型 | 行为 |
|----------|------|
| OpenAI / Sora | `{base}/v1/videos/{upstream}/content` + Bearer |
| **AgnesVideo（新）** | **走 default**：`GetResultURL()` 拉 CDN；SSRF 校验 |
| HappyHorse 等 | 同上 default |

**不要**把 `ChannelTypeAgnesVideo` 加进 OpenAI/Sora case。

代理 URL（`BuildProxyURL`）仍可对外暴露，供：

- 不想依赖第三方 CDN 域名的客户端  
- 用量日志同源预览  

`VideoProxy` 对 default 分支已有「ResultURL 不得指向本网关 content」防递归；CDN 直链不受影响。

同域 session 下 `<video src="/v1/videos/{id}/content">` 可通过 `TokenOrUserAuth`；更稳妥的前端增强见 §8。

---

## 6. 计费设计

官方标价：`$0.005 / 秒`（文档称当前活动价 `$0 / 秒`）——由运营配置，代码不写死。

建议：

1. **预扣**：`EstimateBilling` 从请求提取  
   - `seconds` / `duration`，或  
   - `num_frames / frame_rate`  
   写入 `OtherRatios["seconds"]`（或走 `per_duration`）。  
2. **完成结算**：若上游返回 `usage.duration_seconds` / `seconds`，`AdjustBillingOnComplete` 可按实结算差额（与现有视频任务结算框架一致）。  
3. 所有用户可控时长必须受 `relaycommon.MaxTaskDurationSeconds` 约束。  
4. multi-key 渠道：`InitTask` 在 `ChannelIsMultiKey` 时持久化选中 key（已有逻辑）；轮询用 `resolveTaskPollingKey`。

---

## 7. Playground

### 7.1 最小方案（推荐先做）

- 保持 profile = **`generic`**（现测已覆盖 `agnes-video-v2.0`）。  
- 后端修好 `metadata.url` 后，现有 `use-video-task.ts` 即可预览（CDN 直链）。  

### 7.2 增强方案（可选二期）

新增 `VideoProfileAgnesVideo = "agnes_video"`：

- 能力：分辨率档位 480p/720p/1080p、宽高比 16:9/9:16/…、时长由 frames+fps 控制  
- 表单字段：`width`/`height` 或 size 预设、`num_frames`、`frame_rate`、可选 image / keyframes  
- `buildAgensVideoRequest` 生成符合官方 body 的请求  

### 7.3 前端鉴权增强（可选，与渠道类型解耦）

若 `metadata.url` 是本站 `/v1/videos/.../content`：

- 用轮询同款 API Key `fetch` → `blob:` 再赋给 `<video>`  
- 避免纯 `<video src>` 无 Authorization 的 401  

CDN 直链场景可不做。

---

## 8. 迁移方案

### 8.1 现网对象

| 渠道 | type | 状态 | 模型 |
|------|------|------|------|
| #28 AgensCN | 1 OpenAI | 启用 | `agnes-video-v2.0` 等 |
| #26 AgensGlobal | 1 OpenAI | 禁用 | 同上 |

### 8.2 步骤

1. **发版**：注册 type=62 + adaptor（旧 type=1 行为不变）。  
2. **新建** type=62 渠道（或克隆 #28），BaseURL=`https://api.agnes-ai.cn`，挂载 `agnes-video-v2.0`，multi-key 与现网一致。  
3. **Ability**：将 `agnes-video-v2.0` 的 group 路由切到新渠道（或提高新渠道 priority）。  
4. **验证**：创建 → 轮询 → Playground 预览 → `/content` 代理 → 计费日志。  
5. **下线**：从 OpenAI 渠道 models 中移除 `agnes-video-*`，避免误路由。  
6. **历史任务**：platform=`"1"` 的旧任务继续用 Sora 路径；不强制回填 `UpstreamVideoID`。

### 8.3 回滚

- Ability 切回 type=1 渠道即可；type=62 代码可保留。  

---

## 9. 实现清单

### 9.1 必须（P0）

| 文件 | 变更 |
|------|------|
| `constant/channel.go` | `ChannelTypeAgnesVideo=62`，BaseURLs，Names；Dummy 仍最后 |
| `relay/channel/task/agensvideo/constants.go` | ChannelName、ModelList |
| `relay/channel/task/agensvideo/adaptor.go` | TaskAdaptor 全套 + OpenAIVideoConverter |
| `relay/channel/task/agensvideo/adaptor_test.go` | Create/Fetch/Parse/Convert 表驱动测试 |
| `relay/relay_adaptor.go` | `case ChannelTypeAgnesVideo` |
| `model/task.go` | `TaskPrivateData.UpstreamVideoID` |
| `web/default/src/features/channels/constants.ts` | `60: 'Agnes Video'` + display order |
| `web/default/src/features/channels/lib/channel-type-config.ts` | defaultBaseUrl / hints |
| `web/default/src/features/channels/lib/channel-utils.ts` | icon |
| `web/default/src/i18n/locales/*.json` | 渠道名翻译（走 i18n skill） |

### 9.2 建议（P1）

| 文件 | 变更 |
|------|------|
| `web/classic/src/constants/channel.constants.js` | CHANNEL_OPTIONS 增加 62 |
| `service/playground_video.go` + test | 可选 profile |
| `dto/playground_video.go` | 可选 capabilities |
| Playground 表单 / `build-video-request.ts` | 可选专用 UI |
| `controller/video_proxy.go` | 仅当需要特殊逻辑时；默认不改 |

### 9.3 通常不改

- `router/video-router.go`（共用 `/v1/videos`）  
- `common/api_type.go`（任务型渠道可不加 APIType）  
- `main.go` 注入（已委托 `relay.GetTaskAdaptor`）  

### 9.4 工作量粗估

| 阶段 | 人日 |
|------|------|
| P0 adaptor + 注册 + 单测 + 渠道 UI | 2–3 |
| 迁移 / 联调 / 预览验证 | 0.5–1 |
| P1 playground 专用 profile | 1–2 |
| 前端 blob 预览增强 | 0.5 |

---

## 10. Adaptor 方法契约（实现备忘）

```text
Init
ValidateRequestAndSetAction   // 对齐 OpenAI video / multipart；校验 Agnes 约束
EstimateBilling               // seconds / frames
AdjustBillingOnSubmit         // 通常 nil
AdjustBillingOnComplete       // 可选按 usage 结算
BuildRequestURL               // POST {base}/v1/videos
BuildRequestHeader            // Bearer
BuildRequestBody              // JSON；映射 size/duration → width/height/num_frames/frame_rate
DoRequest / DoResponse        // 解析 task_id + video_id；返回 UpstreamTaskID
FetchTask                     // 优先 /agnesapi?video_id=；否则 /v1/videos/{id}
ParseTaskResult               // 填 Url=metadata.url
ConvertToOpenAIVideo          // SetMetadata("url", GetResultURL())
GetModelList / GetChannelName
```

参考实现优先级：

1. **HappyHorse**：ResultURL + ConvertToOpenAIVideo + 专用 Fetch  
2. **Sora**：Create body / 公开 ID 改写 / Bearer 风格（仅作创建侧参考）  
3. **不要**复制 Sora 的「Url 留空 + Convert 透传」

---

## 11. 测试计划

### 11.1 单测

- Parse：queued / in_progress / completed（含 metadata.url）/ failed  
- FetchTask URL 构造：有/无 `UpstreamVideoID`  
- ConvertToOpenAIVideo：公开 id + metadata.url  
- num_frames 校验：`8n+1` 与上界  
- EstimateBilling：seconds / frames 边界与拒绝超限  

### 11.2 集成 / 手工

1. 管理端创建 type=62 渠道，填 CN BaseURL + key。  
2. Playground 选 `agnes-video-v2.0` 文生视频。  
3. 任务 SUCCESS 后出现 Preview，`<video>` 可播。  
4. `GET /v1/videos/{public_id}` JSON 含 `metadata.url`。  
5. `GET /v1/videos/{public_id}/content`（登录态 / Token）可拉流。  
6. multi-key：提交与轮询使用同一把 key。  
7. 图生（若 P1）：带 `image` URL。  

### 11.3 回归

- 真 OpenAI/Sora 视频渠道行为不变。  
- HappyHorse 等 CDN 渠道预览不变。  

---

## 12. 风险与开放问题

| 风险 | 缓解 |
|------|------|
| `/agnesapi` 与文档不完全一致（鉴权、错误体） | 联调阶段抓包；保留 legacy 回退 |
| CDN URL 有过期时间 | 记录 expires；过期后依赖 VideoProxy 是否还能从上游再取（若不能，提示重新生成） |
| `video_id` 与 `task_id` 同值/异值 | 两字段都存；Fetch 优先 video_id |
| 宽高由网关 `size` 映射不准 | P1 专用 profile；或透传 metadata |
| 命名 Agnes vs Agens | 常量用 AgnesVideo；渠道展示名可运营自定 |
| 仅修 Sora 透传的诱惑 | 可作 **临时 hotfix**，但不替代本方案 |

### 开放问题（实现前确认）

1. 全球站 BaseURL 是否固定为 `https://apihub.agnes-ai.com`？（现网 #26）  
2. 是否一期就做图生 / 关键帧 UI，还是只保证文生 + 透传？  
3. 计费默认走 **ratio×seconds** 还是 **per_duration**？  
4. 历史 platform=`1` 的 Agnes 任务是否需要一次性脚本回填，还是自然淘汰？  

---

## 13. 分期交付建议

| 里程碑 | 内容 | 验收 |
|--------|------|------|
| **M1** | type=62 + adaptor（legacy poll + metadata.url）+ 渠道 UI | Playground 可预览文生视频 |
| **M2** | 优先 `/agnesapi?video_id=` + UpstreamVideoID | 轮询走官方推荐路径 |
| **M3** | 切流迁移 #28；OpenAI 渠道去掉 agnes-video | 生产流量走专用类型 |
| **M4** | playground `agens_video` profile + frames/fps UI | 参数与官方文档对齐 |
| **M5** | 前端 blob 预览增强 | proxy URL 无 cookie 也能播 |

**M1 即可解决当前「没法预览」问题**；完整专用类型价值在 M2–M3。

---

## 14. 决策摘要

| 决策项 | 结论 |
|--------|------|
| 是否新增渠道类型 | **是** → `ChannelTypeAgnesVideo = 62` |
| 是否继续挂 OpenAI | **否**（仅短期兼容存量） |
| 轮询 | 优先 `GET /agnesapi?video_id=`，回退 `GET /v1/videos/{task_id}` |
| 结果 URL | 存 CDN；Convert 注入 `metadata.url` |
| VideoProxy | default 拉 CDN，不进 OpenAI/Sora 分支 |
| Playground profile | M1 保持 generic；M4 可选专用 |
| 对外 API | 保持 `/v1/videos*` |

---

## 附录 A：官方 API 速查

来源：[Agnes Video V2.0 文档](https://www.agnes-ai.cn/zh-Hans/docs/agnes-video-v20)

```text
创建:  POST https://api.agnes-ai.cn/v1/videos
推荐查：GET  https://api.agnes-ai.cn/agnesapi?video_id=<VIDEO_ID>
兼容查：GET  https://api.agnes-ai.cn/v1/videos/<TASK_ID>
完成：  metadata.url = https://platform-outputs.agnes-ai.space/videos/...
状态：  queued | in_progress | completed | failed
时长：  seconds ≈ num_frames / frame_rate
约束：  num_frames ≤ 441 且 8n+1
```

## 附录 B：与「仅修 Sora Convert」对比

| | 仅修 ConvertToOpenAIVideo | 本方案专用渠道 |
|--|---------------------------|----------------|
| 修复预览 | ✅（若注入 proxy/CDN） | ✅ |
| 官方 video_id 轮询 | ❌ | ✅ |
| 与真 Sora 解耦 | ❌ 易误伤 | ✅ |
| CDN vs /content | 仍偏 OpenAI 代理语义 | ✅ 清晰 |
| 成本 | 很低 | 中 |
| 长期可维护性 | 差 | 好 |

**建议：** 若需紧急止血，可先用最小 hotfix 注入 `metadata.url=GetResultURL()`；并行按本文落地 `AgnesVideo` 渠道并完成切流。
