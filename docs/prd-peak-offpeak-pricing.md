# PRD：峰谷定价（Peak / Off-peak）计费类型

> 状态：已实现（MVP）  
> 日期：2026-09-03（修订：工作时间可配置 + 模型广场展示；默认时区 `Asia/Shanghai`；2026-09-04 落地实现）  
> 范围：新增独立计费模式 `peak_offpeak`，对齐 DeepSeek 官方峰谷价卡；**工作时间（峰窗）完全可配置**；**模型广场须展示峰谷价**；**不修改**既有 `ratio` / `tiered_expr` / `per_duration` 行为  
> 相关设计：[`design-peak-offpeak-pricing.md`](./design-peak-offpeak-pricing.md)  
> 上游价卡：[DeepSeek Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/)  
> 对照旧稿：[`prd-tiered-time-period-pricing.md`](./prd-tiered-time-period-pricing.md)（在 `tiered_expr` 内扩展时段；**已被本 PRD 的「独立计费类型」方案替代为产品主路径**）

---

## 1. Executive Summary

### Problem Statement

DeepSeek V4 系列 API 已实行**峰谷分时计价**：

- 工作日高峰（UTC `01:00–04:00` 与 `06:00–10:00`，即北京时间 `09:00–12:00` 与 `14:00–18:00`）按高峰单价计费；
- **其余时间（含周六、周日全天）**按空闲单价计费；
- 空闲价为高峰价的一半；
- 缓存命中 / 缓存未命中 / 输出三项同步分档。

现有三种计费模式均无法以**一等公民产品能力**落地该合同：

| 模式 | 缺口 |
|------|------|
| `ratio` / 按次 | 只有一套单价，无时段、无工作日约束 |
| `tiered_expr` | 虽可用 `hour()` 手写峰谷，但可视化不能配多段白天窗口 + 周末全谷；预扣/结算各读墙钟会跨窗跳档；日志/定价页难展示两套价 |
| `per_duration` | 面向视频时长，与 token 峰谷无关 |

管理员需要**专用计费类型**：表单化配置时区、窗口、工作日规则与峰/谷价表，一键套用 DeepSeek 官方预设，且对未切换模式的模型**零影响**。

### Proposed Solution

**新增计费模式 `peak_offpeak`（产品文案：峰谷定价 / Peak·Off-peak）。**

- 配置为结构化价卡（与 `per_duration` 同属「模式 + 专属配置表」），**不**依赖、不改写 `billing_expr`。
- **工作时间完全可配置**：时区、高峰窗口段数/起止、是否仅工作日生效均可由管理员按模型修改；DeepSeek 预设只是默认填充，不是写死全局常量。
- 计费公式与 DeepSeek 一致：按**请求进入网关并完成预扣快照的冻结时刻**判定峰/谷，再按对应 `$/1M tokens` 价表对 `p` / `cr` / `c`（及可选扩展变量）计价。
- 提供 DeepSeek V4 Flash / Pro / Flash-Vision-Exp 官方预设。
- **模型广场（`/pricing`）**对 `peak_offpeak` 模型展示计费类型徽章、列表价摘要（峰/谷）与详情页完整价表+窗口。
- 既有三种模式的代码路径、配置、结算、日志、定价页展示保持兼容；仅当模型的 `billing_mode` 显式为 `peak_offpeak` 时进入新路径。

### Success Criteria

1. 管理员可为模型选择「峰谷定价」，**自由配置**时区、高峰工作时间窗口、工作日开关、峰/谷单价并保存生效；也可一键套用 DeepSeek 预设后仍可再改窗口再保存。
2. 修改高峰窗口后，后续请求按**新配置**判定峰/谷（例如把 `01:00–04:00` 改成 `02:00–05:00` 立即生效），无需发版。
3. 同一组 token 在冻结时刻落在高峰窗口时扣高峰价，落在空闲（含 `weekdays_only` 下的周末）时扣空闲价；DeepSeek 预设下空闲 = 高峰 × 0.5（验收见 §7）。
4. 预扣与结算使用同一冻结时刻；跨窗流式请求不因结算时刻改档。
5. **模型广场**列表（表格/卡片）与模型详情页均可识别并展示峰谷定价；用户无需进入管理后台即可看到两套单价与高峰时段说明。
6. 消费日志可区分 `peak` / `off_peak`，并记录求值时刻。
7. 未配置为 `peak_offpeak` 的模型：`ratio` / `tiered_expr` / `per_duration` **行为与扣费零回归**；模型广场对其它计费类型的展示不受影响。

---

## 2. User Experience & Functionality

### User Personas

| 角色 | 诉求 |
|------|------|
| 系统管理员 | 按上游/自有价卡配置模型；**高峰工作时间可改**；最好有 DeepSeek 一键预设 |
| API 调用方 | 按请求进入时刻被准确预扣；流式耗时跨窗不改价 |
| 终端用户（模型广场 / 消费日志） | 在模型广场直接看到峰谷价与时段；日志中可核对本次命中档 |

### User Stories

#### Story 1 — 管理员选择新计费类型并配置价卡（含可配置工作时间）

> As a 管理员, I want to 为模型选择「峰谷定价」并自行配置时区、高峰工作时间窗口与峰/谷单价, so that 计费与上游或自有价卡一致，且不必手写表达式、也不被 DeepSeek 默认窗口锁死。

**Acceptance Criteria**

- 定价模式枚举在现有 `per-token` / `per-request` / `tiered_expr` / `per_duration` 之外增加 **`peak_offpeak`**。
  - 产品文案：中文「峰谷定价」；英文「Peak / Off-peak」。
- 选择该模式后，配置界面展示结构化表单（**不是**阶梯表达式编辑器）：
  - **时区**：IANA 名称，**默认 `Asia/Shanghai`**（国内运营与 DeepSeek 北京时间窗口一致）；亦可改为 `UTC` 等其它时区并改写对应窗口。非法时区**拒绝保存**。
  - **高峰仅工作日**：开关，默认开启（Mon–Fri 才可能高峰；Sat/Sun 恒为空闲）。关闭后每日重复峰窗（兼容无周末例外的厂商）。
  - **高峰工作时间（峰窗）列表 —— 必须可配置，不得写死在代码路径中作为唯一窗口**：
    - ≥ 1 段，格式 `HH:mm`，半开区间 `[start, end)`。
    - 支持增删改多段（OR 合并，如上午 ∪ 下午）。
    - 支持与 DeepSeek 不同的自定义窗口（例如仅 `09:00–18:00` 一段，或三班倒多段）。
    - DeepSeek 预设填入的窗口只是初始值；保存后管理员仍可修改时段再保存，计费以最新配置为准。
  - **高峰价表** / **空闲价表**：至少支持
    - 输入缓存命中 `cache_hit`（对应计费变量 `cr`）
    - 输入缓存未命中 `cache_miss`（对应 `p`）
    - 输出 `completion`（对应 `c`）
  - 可选扩展（MVP 可隐藏，配置位预留）：`cache_creation` / `image` / `audio_in` / `audio_out`；未配置则不单独计价（归入 `p`/`c` 语义与 `tiered_expr` 自动排除规则对齐，见设计文档）。
  - **按高峰 × 倍率填空闲**：默认倍率 `0.5`；倍率必须 `> 0`、有限、非 NaN。
- 窗口重叠在保存时拒绝；跨午夜窗口允许（`start > end` → `tod >= start || tod < end`）。
- 所有单价必须 `> 0`、有限；保存后立即对后续请求生效。
- 一个模型同一时刻只能处于一种定价模式；切换为 `peak_offpeak` 时不再走 `ModelRatio` / `ModelPrice` / `billing_expr` / `duration_pricing` 主路径。
- **验收**：将高峰窗口从预设的 `09:00–12:00` 改为 `10:00–13:00`（`Asia/Shanghai`）并保存后，冻结时刻北京时间工作日 `09:30` 应变为**空闲**；`10:30` 应变为**高峰**。

#### Story 2 — DeepSeek 官方预设

> As a 管理员, I want 一键套用 DeepSeek 官方峰谷价, so that 不必对照文档手填。

**Acceptance Criteria**

- 提供至少：
  - `DeepSeek V4 Flash`
  - `DeepSeek V4 Pro`
  - `DeepSeek V4 Flash Vision Exp`（价表与 Flash 相同）
- 预设内容锁定官方口径（[pricing](https://api-docs.deepseek.com/quick_start/pricing/)）：

| 字段 | 值 |
|------|-----|
| 时区 | `Asia/Shanghai`（产品默认；等价于官方文档的 UTC 窗口） |
| 高峰仅工作日 | 是（Mon–Fri） |
| 高峰窗口 | `[09:00, 12:00)`、`[14:00, 18:00)` |
| 空闲 | 其余时间（含周末全天） |

| 模型 | 时段 | 缓存命中 `/1M` | 缓存未命中 `/1M` | 输出 `/1M` |
|------|------|----------------|------------------|------------|
| deepseek-v4-flash | 空闲 | $0.007 | $0.22 | $0.66 |
| deepseek-v4-flash | 高峰 | $0.014 | $0.44 | $1.32 |
| deepseek-v4-pro | 空闲 | $0.022 | $0.66 | $1.98 |
| deepseek-v4-pro | 高峰 | $0.044 | $1.32 | $3.96 |
| deepseek-v4-flash-vision-exp | 同 Flash | 同 Flash | 同 Flash | 同 Flash |

- 与官方文档 UTC 表述等价：高峰 UTC `01:00–04:00`、`06:00–10:00`（Mon–Fri）＝ 北京时间 `09:00–12:00`、`14:00–18:00`。预设与表单默认一律存 **`Asia/Shanghai` + 北京时间窗口**，避免运营手填 UTC。
- 预设只填充编辑器，**不**在未保存时改写线上价格。
- 上游改价时更新预设数字；本 PRD 锁定的是**机制**，价表可随预设迭代。

#### Story 3 — 按请求进入时刻计费（预扣 = 结算时钟）

> As a API 调用方, I want the gateway to freeze the billing clock at pre-consume, so that a streaming call crossing a peak boundary is not repriced at settlement.

**Acceptance Criteria**

- **计费时刻** = 该请求首次进入峰谷预扣（创建计费快照）时的瞬时。
- 自动分组重试**不得**刷新该时刻（与价卡配置快照一并冻结）。
- 峰/谷判定只读冻结时刻 + 配置，禁止结算再读 `time.Now()`。
- 边界（配置为 `Asia/Shanghai` + 工作日高峰，半开区间）：

  | 冻结时刻 (Asia/Shanghai) | 星期 | 窗口 |
  |--------------------------|------|------|
  | Mon 08:59:59 | 工作日 | 空闲 |
  | Mon 09:00:00 | 工作日 | 高峰 |
  | Mon 11:59:59 | 工作日 | 高峰 |
  | Mon 12:00:00 | 工作日 | 空闲 |
  | Mon 13:59:59 | 工作日 | 空闲 |
  | Mon 14:00:00 | 工作日 | 高峰 |
  | Mon 17:59:59 | 工作日 | 高峰 |
  | Mon 18:00:00 | 工作日 | 空闲 |
  | Sat 10:00:00 | 周末 | **空闲**（即使落在「峰窗钟点」） |
  | Sun 16:00:00 | 周末 | **空闲** |

- 预扣与结算允许因 **token 数量**不同产生差额，**不允许**因时钟不同产生差额。
- 异步任务若未来接入本模式：在提交预扣时冻结；本需求不以「完成时刻」改价。

#### Story 4 — 日志与对账

> As a 用户/管理员, I want usage logs to show which peak/off-peak window applied, so that charges are auditable.

**Acceptance Criteria**

- 消费日志 `other` 至少包含：
  - `billing_mode`: `"peak_offpeak"`
  - `matched_tier` 或等价字段：`peak` / `off_peak`
  - `billing_eval_at`：冻结时刻 RFC3339（或 Unix 秒 + IANA 时区）
  - 可选：当时生效的 `peak_windows` 摘要或配置 hash（实现可裁剪，语义不可缺「命中档 + 时刻」）
- 用量详情展示本次命中档，并可对照峰/谷两套单价。

#### Story 4b — 模型广场展示峰谷定价（MVP 必做）

> As a 终端用户, I want the model plaza (`/pricing`) to show peak and off-peak prices and working hours, so that I can compare models without opening admin settings.

**Acceptance Criteria**

- 公开定价 API（模型广场数据源）对 `billing_mode === peak_offpeak` 的模型下发完整 `peak_offpeak_pricing`（时区、`weekdays_only`、峰窗、峰/谷价表），不得只下发 mode 字符串而无价表。
- **计费类型徽章**：列表表格 Type 列、模型卡片、模型详情均显示「峰谷定价」/ `Peak / Off-peak`（与「按 Token」「按时长」「动态计价」并列），不得误标为 Dynamic / Token-based。
- **列表摘要（表格 Price 列 + 卡片价格区）**至少展示：
  - 高峰与空闲两套**输入（缓存未命中）**与**输出**单价（或「高峰 from X / 空闲 from Y」等价可读摘要）；
  - 不得只显示单一均价或空白 `-`。
  - 遵循站点现有 `tokenUnit`（1K/1M）、分组倍率、充值汇率展示规则。
- **模型详情页（`/pricing/$modelId`）**完整展示：
  - 高峰工作时间窗口列表（按配置时区格式化，如 `09:00–12:00 Asia/Shanghai`）；
  - 「仅工作日高峰 / 周末全空闲」说明（当 `weekdays_only=true`）；
  - 峰 / 谷两行价表：缓存命中、缓存未命中、输出（及已配置的扩展项）。
- 管理员修改峰窗或单价并保存后，模型广场在定价缓存刷新后展示**新配置**（与现有 pricing 刷新机制一致）。
- 非 `peak_offpeak` 模型的广场卡片/表格/详情展示**零回归**。
- MVP **不要求**广场按浏览者本地时钟实时高亮「当前为高峰」；若做，仅为展示提示，不得影响计费。

#### Story 5 — 与现有计费类型隔离（零回归）

> As a 平台方, I want existing billing modes to keep working unchanged when this feature ships.

**Acceptance Criteria**

- 默认未设置 `billing_mode` 或值为 `ratio` 的模型：行为与上线前完全一致。
- `tiered_expr`：表达式引擎、可视化编辑器、预扣/结算、`matched_tier` 日志路径不变；**本需求不修改** `hour()` 实现亦可交付（时钟冻结仅在 `peak_offpeak` 路径内完成）。若后续顺带为 `tiered_expr` 冻时钟，须单独回归，不得作为本 MVP 阻塞项。
- `per_duration`：视频时长计价路径不变。
- 切换模式时：旧模式配置可保留在 options 中但不生效；切回原模式后原配置仍可用（与现有模式切换一致）。
- 管理端模式 Tab / 筛选计数增加 `peak_offpeak`，不影响其它 Tab。
- 模型广场对其它 `billing_mode` 的徽章与价格摘要逻辑不被本功能破坏。

### Non-Goals（本版不做）

- 不把峰谷做成 `tiered_expr` 的唯一官方写法（旧 PRD 方案降为可选高级路径，非本需求交付物）。
- 不做节假日/例外日日历（仅「每日可配置窗口 ± 工作日开关」）。
- 不做请求过程分段计费（一次请求一个窗口）。
- 不自动拉取 DeepSeek 官方价卡；预设为仓库内静态模板。
- 不实现用户侧错峰调度 / 排队到闲时再发。
- 不在本需求中改造 `relaykit/` 公共 API（若未必要依赖则保持独立）。
- 模型广场不做按用户时区自动换算编辑配置（展示可用辅助文案；计费仍以配置时区为准）。

---

## 3. AI System Requirements

本需求非 AI 推理功能，本节不适用。

---

## 4. Technical Specifications（产品级约束）

### 4.1 模式与存储

| 项 | 约定 |
|----|------|
| `billing_mode` 值 | `peak_offpeak` |
| 专属配置字段 | `billing_setting.peak_offpeak_pricing`（JSON map：`model → PeakOffPeakConfig`） |
| 与 `billing_expr` / `duration_pricing` | 互不覆盖；模式切换后只读当前模式对应配置 |

### 4.2 判定与公式

```
evalAt = snapshot.EvalUnix                    // 预扣写入，结算只读
local  = evalAt in config.Timezone
tod    = hour*60 + minute                     // [0, 1440)

is_weekend = weekday in {Sat, Sun}            // 时区内星期
is_peak = (!config.WeekdaysOnly || !is_weekend)
          && tod ∈ any peak window [start, end)

prices = is_peak ? PeakPrices : OffPeakPrices

costUSD = (p * prices.cache_miss
         + cr * prices.cache_hit
         + c * prices.completion
         + …optional…) / 1e6

quota = convert(costUSD × groupRatio)         // 现有 QuotaPerUnit 链路
```

Token 归一化（缓存是否从 `p` 中扣除）必须与现有文本结算对 Claude / OpenAI usage 语义的处理一致，避免重复计费；细则见设计文档。

### 4.3 计费安全

- 遵循 AGENTS.md：单价与倍率 `> 0`、有限；配额换算走 `common.QuotaFrom*Checked`；禁止负数扣费。
- 时段条件只依赖冻结时钟与管理员配置，不读取用户可控字段选择更便宜窗口。
- 用户可控的 token 数量仍受现有 `max_tokens` 等边界约束。

### 4.4 集成触点（概要）

| 层级 | 变更 |
|------|------|
| `setting/billing_setting` | 新常量、**可配置** `PeakWindows` 结构、校验、Get/Copy、PricingSync |
| `relay/helper/price.go` | `ModelPriceHelper` 增加 `peak_offpeak` 分支（与现有分支并列）；窗口只读配置不读硬编码 |
| 新包或 `service/peak_offpeak_*.go` | 窗口判定、预扣估算、结算差额 |
| `service/log_info_generate.go` | 注入 `billing_mode` / 命中档 / `billing_eval_at` |
| `model/pricing.go` | 公开定价 API **必须**下发 `peak_offpeak_pricing` 供模型广场 |
| 管理端模型定价 Sheet / Visual Editor | 新 Tab + **可编辑峰窗**表单 + DeepSeek 预设 |
| **模型广场** `web/src/features/pricing/*` | badge、列表/卡片摘要、详情页峰谷价表与工作时间 |
| 用量日志 | 命中档展示 |

详细模块、数据结构、测试矩阵见 [`design-peak-offpeak-pricing.md`](./design-peak-offpeak-pricing.md)。

---

## 5. Risks & Roadmap

### Phased Rollout

| 阶段 | 内容 |
|------|------|
| **MVP** | 新模式 + **可配置工作时间** + 工作日开关 + DeepSeek 预设 + 冻结时钟 + 日志 + **模型广场列表/详情展示峰谷价** + 边界单测 + 旧模式回归 |
| **v1.1** | 可视化扩展 cache creation / image / audio；广场「当前窗口」提示；人民币展示（仍按站点汇率） |
| **v2.0** | 可选节假日日历；完成时刻重计价（默认关闭） |

### Technical Risks

| 风险 | 影响 | 缓解 |
|------|------|------|
| 误改 `tiered_expr` / `ratio` 公共路径 | 全站计费回归 | 新模式独立分支；回归测试强制覆盖旧三模式 |
| 预扣与结算各读 `Now()` | 跨窗错档资损 | 快照冻 `EvalUnix`；跨窗集成测试 |
| 周末规则遗漏 | 周六上午按高峰错扣 | 官方预设默认 `weekdays_only=true`；周末用例必测 |
| 峰窗写死为 DeepSeek 常量 | 无法按商户自有时段调价 | 配置驱动 `PeakWindows`；自定义窗口验收用例 |
| 模型广场未下发/未渲染价表 | 用户只看到徽章或空白价 | API 契约 + 前端列表/详情验收；对照 `per_duration` 展示模式 |
| 只用 `hour` 不含 `minute` | `04:00:00` 边界错误 | 半开区间 + `tod` 分钟数 |
| Token 语义与 Claude/OpenAI 不一致 | 缓存双重计费 | 复用现有 usage remap / 变量排除逻辑 |
| 配置与 `tiered_expr` 并存混淆 | 管理员不知以谁为准 | UI 单选模式；后端只读当前 mode |

### Open Questions

1. **默认时区**：**已锁定为 `Asia/Shanghai`**（表单默认值与 DeepSeek 预设一致）。管理员仍可改为 `UTC` 等其它 IANA 时区。
2. **旧快照**：若复用/扩展 `BillingSnapshot`，上线瞬间已预扣未结算请求如何处理？（预期极少；可回退结算墙钟并 warn，或仅新模式新字段。）
3. **人民币价卡**：国内转载多为 ¥；系统口径保持 USD，定价页用站点汇率是否足够？
4. **与旧 PRD**：是否保留「在 `tiered_expr` 可视化里配时段」为后续增强，还是永久只走本模式？

---

## 6. 测试计划（验收）

必须使用可注入时钟，禁止依赖真实 `time.Now()` 断言峰/谷。

- **窗口判定**
  - DeepSeek 预设边界表（§2 Story 3）全覆盖。
  - 周末北京时间 10:00 → `off_peak`。
  - `weekdays_only=false` 时周末峰窗钟点 → `peak`。
  - **自定义工作时间**：配置改为 `[10:00, 13:00)` 后，`09:30` → 空闲、`10:30` → 高峰（Story 1 验收）。
- **计价**
  - Flash：`p=1e6,c=1e6,cr=0` @ Mon 10:00 Asia/Shanghai → `1.76`；@ Mon 13:00 → `0.88`；@ Sat 10:00 → `0.88`。
  - 缓存命中：`cr=1e6` 高峰 `0.014` / 空闲 `0.007`。
  - Pro 同构验收。
- **预扣/结算**
  - 同一 `EvalUnix`、不同 token → 仅 token 差额。
  - 禁止结算改时刻导致跳档的回归锁。
- **模型广场**
  - 定价 API fixture 含 `peak_offpeak_pricing` 时：badge 文案正确；列表/卡片非 `-`；详情页含窗口与双价表。
  - 改配置后公开 DTO 反映新窗口（单元或集成）。
  - `per_duration` / `tiered_expr` / token 模型广场展示回归。
- **隔离回归**
  - 未配置峰谷的 Claude/GPT `ratio` 与 `tiered_expr` 样例扣费不变。
  - `per_duration` 视频模型预扣不变。
  - 非法时区 / 非正单价拒绝保存；新建表单默认时区为 `Asia/Shanghai`。
- **前端管理端**
  - 预设 → 表单回填（时区 `Asia/Shanghai`，窗口 `09:00–12:00` / `14:00–18:00`）→ 可改窗口 → 保存 payload 含自定义 `peak_windows`。
  - 重叠窗口拒绝；0.5 倍率填表后三项均为高峰一半。

---

## 7. 公式与示例（规格摘要）

**Flash 数值验收**（groupRatio = 1，单位表达式输出为美元成本；时区 `Asia/Shanghai`）：

| 冻结时刻 | p | cr | c | 期望 costUSD |
|----------|---|----|---|--------------|
| Mon 10:00 CST 高峰 | 1_000_000 | 0 | 1_000_000 | `0.44 + 1.32 = 1.76` |
| Mon 13:00 CST 空闲 | 1_000_000 | 0 | 1_000_000 | `0.22 + 0.66 = 0.88` |
| Sat 10:00 CST 空闲 | 1_000_000 | 0 | 1_000_000 | `0.88` |
| Mon 10:00 CST 高峰 | 0 | 1_000_000 | 0 | `0.014` |
| Mon 13:00 CST 空闲 | 0 | 1_000_000 | 0 | `0.007` |

空闲行必须严格等于对应高峰行的 1/2。

---

## 8. 与旧方案关系

| 方案 | 文档 | 产品定位 |
|------|------|----------|
| **独立计费类型 `peak_offpeak`** | 本文 + design | **主交付**：表单化、可审计、与 DeepSeek 官方合同一一对应 |
| 在 `tiered_expr` 内用 `tod()`/`tier()` 手写峰谷 | `prd-tiered-time-period-pricing.md` | 高级可选；本需求**不依赖**其完成即可上线 |

选择独立类型的原因：满足「增加新的计费类型」；配置面更贴官方价卡；对表达式引擎与现有阶梯用户**零强制迁移、零行为耦合**。
