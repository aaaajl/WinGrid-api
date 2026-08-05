# PRD：视频按时长 × 分辨率（size）定价

> 状态：已实现（MVP）  
> 日期：2026-07-15  
> 范围：在现有「按 token」「按次」之外，新增第三种模型定价方式，用于视频生成类模型的预扣费

---

## 1. Executive Summary

### Problem Statement

视频生成模型按「分辨率决定每秒单价、再乘时长」计费，与现有「按 token（`ModelRatio`）」和「按次固定价（`ModelPrice`）」语义都不匹配。当前只能用 `ModelPrice × OtherRatios` 硬凑，分辨率档位倍率写死在各 adaptor 中，管理员无法按 `size` 配置每秒基础价。

### Proposed Solution

新增定价模式 **按视频时长（`per_duration`）**：根据请求中的 `size` 解析每秒基础价 `basePrice`，再按公式

\[
\text{单次费用（美元）} = \text{basePrice}(\text{size}) \times \text{duration}
\]

换算为系统配额后，在任务提交时做预扣费。

### Success Criteria

1. 管理员可为模型选择「按时长」模式，并配置 `size → $/秒` 映射（含默认档与兜底价）。
2. 同一模型请求 `size=720P, duration=5` 与 `size=1080P, duration=5` 预扣额严格按配置的 basePrice 比例计费（验收用例见 §2）。
3. 未配置或非法的 `duration`/`size` 在预扣前被拒绝（HTTP 400），不会产生负数、NaN 或超大配额。
4. 仍使用「按 token / 按次」的模型行为零回归。
5. 公开定价展示能区分该模式，并可读出「按分辨率每秒单价」。

---

## 2. User Experience & Functionality

### User Personas

| 角色 | 诉求 |
|------|------|
| 系统管理员 | 为视频模型配置分辨率档位的每秒价格 |
| API 调用方 | 按请求的 `size` + `duration` 被准确预扣，费用可预期 |
| 终端用户（消费日志） | 在用量/日志中看到与「按时长定价」一致的扣费说明 |

### User Stories

#### Story 1 — 管理员配置按时长定价

> As a 管理员, I want to 为某个视频模型选择「按时长」定价并为不同 `size` 设置每秒基础价, so that 计费规则与上游/商业定价一致且可在后台维护。

**Acceptance Criteria**

- 定价模式枚举在现有 `per-token` / `per-request` / `tiered_expr` 之外增加 **`per_duration`**（产品文案：「按时长」/「按视频时长」）。
- 选择该模式后，配置界面展示：
  - **分辨率单价表**：`size` 键 → 每秒价格（美元，与现有 `ModelPrice` 同货币口径）。
  - **兜底价（fallback）**：未命中表内任何 `size` 时使用的每秒价格。
- MVP 默认示意配置（可保存为默认模板或文档说明，非强制写死为全局默认）：

  | size（规范化后） | basePrice（$/秒） |
  |------------------|-------------------|
  | `480P`           | `1`               |
  | `720P`           | `1`               |
  | `1080P`          | `2`               |
  | `4k`           | `10`               |
  | *其他*（fallback） | `10`             |

- 保存后立即对后续请求生效（与现有比值/价格配置发布机制一致）。
- 一个模型同一时刻只能处于一种定价模式；切换为 `per_duration` 时，该模型不再走 `ModelRatio` / `ModelPrice` 固定价主路径。

#### Story 2 — 按请求 size × duration 预扣费

> As a API 调用方, I want the gateway to charge `basePrice(size) × duration` on submit, so that my quota deduction matches video length and resolution.

**Acceptance Criteria**

- **输入字段**（任务提交请求）：
  - `size`：分辨率档位字符串（见 §4 规范化规则）。若请求同时带有 `resolution` / `metadata.resolution`，字段优先级在实现阶段与现有各 adaptor 对齐；**计费读取以规范化后的 size 键为准**。
  - `duration`（或现有等价字段 `seconds`）：视频时长，单位为秒，正整数（允许与现有任务校验一致的解析路径）。
- **计价公式（美元）**：

  ```
  basePrice = lookup(sizePriceMap, normalize(size))
             ?? fallbackPrice
  costUSD   = basePrice × duration
  ```

- **配额换算**：`costUSD` 经现有 `QuotaPerUnit` 与用户/令牌 `groupRatio` 等统一系数换算为配额（与按次计费同一套额度单位），再走任务预扣费链路。
- **验收数值示例**（假设 groupRatio=1，且 `1 USD → QuotaPerUnit` 与线上一致）：

  | size   | duration | basePrice | costUSD |
  |--------|----------|-----------|---------|
  | 480P   | 5        | 2         | 10       |
  | 720P  | 5        | 2         | 10      |
  | 1080P | 5        | 5 | 25  |
  |  4K  | 10       | 10         | 100      |
  

- 预扣发生在上游任务创建之前；预扣失败则不创建任务。

#### Story 3 — 校验与安全边界

> As a 系统, I want duration and price inputs bounded, so that billing cannot overflow or go negative.

**Acceptance Criteria**

- `duration` / `seconds` 必须满足：`1 ≤ duration ≤ MaxTaskDurationSeconds`（现有常量，当前为 3600）；越界返回 400。
- `basePrice` 与 `fallbackPrice` 配置必须为有限正数（`> 0`，非 NaN/Inf）；非法配置拒绝保存或在解析时报错并不启用错误价格。
- `costUSD` / 配额换算必须走现有 `common.QuotaFrom*` / `*Checked` 路径，禁止裸 `int` 截断；饱和时按项目既有计费安全规范记审计标记。
- 缺省 `duration`：若平台有明确默认时长（如某 adaptor 默认 5 秒），**仅在该模型/通道文档约定允许默认时**可用默认值参与计费；否则缺省应 40。具体默认策略在实现时按通道对齐，但计费所用 duration 必须与发给上游的时长一致。

#### Story 4 — 日志与对外展示

> As a 用户/管理员, I want consumption logs and pricing pages to reflect per-duration billing, so that charges are auditable.

**Acceptance Criteria**

- 任务消费日志 `other`（或等价字段）记录：`billing_mode=per_duration`、规范化 `size`、`duration`、`base_price`、`cost`（或配额）、命中的价表键或 `fallback`。
- 公开定价 API / 定价页：对该模型暴露可读的按时长规则（至少：各 size 单价与 fallback），`quota_type` / `billing_mode` 与「按 token / 按次」可区分。

### Non-Goals（本版不做）

- **不以任务完成后的实际上游时长做差额追缴/退款**（MVP 仅按请求参数预扣并结算锁定；完成态不因 `AdjustBillingOnComplete` 改价）。后续若需要可单独立项。
- 不替换或重构 `tiered_expr` 表达式引擎；本模式不依赖 billingexpr。
- 不要求一次覆盖全部视频通道的业务校验差异；**计费读取 size/duration 的通用层 + 管理配置**为 MVP，各 adaptor 仍可保留上游字段校验。
- 不做「按时长档位一口价 SKU」（如仅 4/8/12 秒固定价）公式。
- 不做按 token 结算的视频模型（如部分 Seedance token 价）迁移；此类继续用现有模式。
- 不改变非视频任务（绘图、音乐等）的既有按次价逻辑，除非管理员主动把该模型改成 `per_duration`。

---

## 3. AI System Requirements

本需求非 AI 推理功能，本节不适用。

---

## 4. Technical Specifications

### Architecture Overview

```
Client Request (size, duration)
        │
        ▼
Task Validate ──► normalize size / bound duration
        │
        ▼
Price Resolve (per_duration)
        │  basePrice = map[size] ?? fallback
        │  quota = f(basePrice × duration, groupRatio, QuotaPerUnit)
        ▼
PreConsumeBilling ──► Upstream Submit ──► Settle（锁定预扣，无时长差额）
        │
        ▼
Task log + billing context 持久化
```

与现有模式关系：

| 模式 | 配置 | 主公式 |
|------|------|--------|
| per-token | `ModelRatio` + … | tokens × ratio |
| per-request | `ModelPrice` | 固定价 ×（可选硬编码 OtherRatios） |
| tiered_expr | `billing_expr` | 表达式 → $/1M tokens |
| **per_duration（新增）** | size→$/秒 表 + fallback | **basePrice(size) × duration** |

### size 规范化规则

计费前统一规范化（与 HappyHorse 等现有逻辑对齐，作为默认规范）：

1. `TrimSpace` + 转大写。
2. 若值已是像素对（如 Sora 的 `1280x720`）：MVP **不按像素对自动换算为 720P**；应走 fallback，或管理员在价表中直接配置该原始字符串键。若某通道把 `size` 映射为 `720P`/`1080P`，规范化发生在通道已写入计费字段之后。
3. 若值为 `720` / `1080` 等无 `P` 后缀的数字档，允许补全为 `720P` / `1080P`（与现有 happyhorse 行为一致）。
4. 价表查找使用规范化后的键；未命中则用 `fallbackPrice`。

### duration 解析规则

- 优先顺序建议与现有任务工具一致：显式 `duration` → `seconds`（字符串/数值）→（可选）`metadata` 内时长字段 → 通道默认值（若允许）。
- 计费使用的秒数必须与 `EstimateBilling` / 实际上送上游的时长同源，避免「发给上游 5 秒、扣费按 10 秒」。

### Integration Points

| 层级 | 变更要点 |
|------|----------|
| 配置存储 | 新增模型级 `per_duration` 配置（价表 + fallback）；与 `ModelPrice`/`ModelRatio`/`billing_mode` 互斥切换 |
| `relay/helper` 价格助手 | 任务路径 `ModelPriceHelperPerCall`（或并列助手）识别 `per_duration` 并计算配额 |
| `relay/relay_task.go` | 预扣前注入 duration/size；`OtherRatios` 不再作为该模式主倍率来源（避免二次乘时长） |
| `service/task_*` | BillingContext 持久化新模式字段；完成态保持预扣锁定 |
| 管理端 UI | `PricingMode` 增加选项与价表编辑器 |
| 公开定价 | `model/pricing.go` 等暴露新模式与价表摘要 |
| 默认示例 | 文档/可选默认：720P=1，1080P=2，fallback=5（美元/秒） |

### 与现有 OtherRatios 的边界（重要）

当前部分 adaptor 的 `EstimateBilling` 会返回 `{"seconds": N, "size": M}`，再由框架做 `ModelPrice × ∏ ratios`。  
在 **`per_duration` 模式下**：

- **总价已由 `basePrice × duration` 一次算清**；
- 框架 **不得再** 乘以 adaptor 返回的 `seconds`（或等价时长倍率），否则会变成 `basePrice × duration²`。
- 分辨率倍率也不应再通过 `size` OtherRatio 二次计入。  
  实现上：该模式下以价格助手产出的最终配额为准，忽略或跳过用于旧「按次×倍率」的 OtherRatios 合成。

### Security & Privacy / Billing Safety

- 遵循 AGENTS.md 计费安全不变量：倍率/价格 > 0、时长有上界、配额换算用 Checked 辅助函数、禁止负数扣费。
- 价格配置属管理员能力，走既有系统设置鉴权；不新增对外可写接口给普通用户改价。
- 日志中的 size/duration 为请求业务参数，不记录无关键隐私字段。

### 配置结构（建议草案，实现可微调字段名）

```json
{
  "billing_mode": "per_duration",
  "duration_pricing": {
    "fallback_price": 5,
    "size_prices": {
      "720P": 1,
      "1080P": 2
    }
  }
}
```

说明：`fallback_price` / `size_prices` 的单位均为 **美元/秒**，与现有 `ModelPrice` 美元口径一致，再经 `QuotaPerUnit` 转配额。

---

## 5. Risks & Roadmap

### Phased Rollout

| 阶段 | 内容 |
|------|------|
| **MVP** | 新增 `per_duration` 模式；管理端价表 + fallback；任务提交按 `basePrice × duration` 预扣；日志与定价页基础展示；跳过该模式下旧 OtherRatios 二次乘积；回归测试覆盖 §2 数值表 |
| **v1.1** | 通道适配清单（Sora / Veo / HappyHorse / 阿里万相等）统一 size 规范化与 duration 同源；公开定价 UI 更友好 |
| **v2.0** | 可选：任务完成后按实际上游时长差额结算；像素尺寸 → 档位自动映射规则可配置 |

### Technical Risks

| 风险 | 影响 | 缓解 |
|------|------|------|
| 与旧 `ModelPrice × seconds` 双路径并存导致双重计费 | 用户被多扣费 | `per_duration` 分支显式禁用时长类 OtherRatios；加单测锁死 |
| 各通道 `size` 语义不一致（`720P` vs `1280x720`） | 误走 fallback 高价 | 文档说明 + 价表支持原始键；后续做映射表 |
| 管理员把非视频模型设为 per_duration | 缺字段请求大量 400 | UI 提示适用场景；缺 duration 明确报错 |
| 默认示意价（1/2/5）被误当生产价 | 商业资损或客诉 | 配置必须由管理员显式保存；默认仅作模板说明 |

### Open Questions（请确认）

1. **模式互斥**：进入 `per_duration` 后，是否从 `ModelPrice` 映射中移除该模型键，还是保留但忽略？
2. **缺省 size**：请求未传 `size` 时，用 fallback 计费，还是直接 400？
3. **groupRatio / 模型倍率**：是否仅 `costUSD × QuotaPerUnit × groupRatio`，不再乘任何 model ratio？
4. **首批落地模型**：是否仅 HappyHorse，还是所有视频任务模型均可切换？

---

## 6. 测试计划（验收）

- 单元：size 规范化；价表命中 / fallback；`basePrice × duration` → 配额；非法 duration/price 拒绝；**per_duration 不再乘 seconds OtherRatio**。
- 任务集成：预扣成功/余额不足；日志字段完整。
- 回归：同一环境下 per-token、per-request、tiered_expr 模型报价与扣费不变。
- 前端：模式切换、价表编辑与校验（正数）、i18n 文案齐全。

---

## 7. 公式与示例（规格摘要）

```
normalize(size) → key
basePrice = size_prices[key] if present else fallback_price
costUSD   = basePrice * duration
quota     = convert(costUSD)   // 现有 QuotaPerUnit + group 等
```

**示例配置**：720P → 1 USD/秒，1080P → 2 USD/秒，其他 → 5 USD/秒。  
**示例请求**：`size=1080P`, `duration=5` → `costUSD = 2 × 5 = 10`。
