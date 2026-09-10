# PRD：阶梯计费按时段（峰谷）定价

> 状态：**已由独立计费类型方案替代（产品主路径）**  
> 日期：2026-08-14（替代说明更新：2026-09-03）  
> 范围：在现有 `tiered_expr` 阶梯计费中，让模型可按时区、多段每日窗口配置不同单价（峰谷价）；以 DeepSeek API 峰谷定价为验收样例  
> 相关设计：[`pkg/billingexpr/expr.md`](../pkg/billingexpr/expr.md)  
> **替代文档（请优先实施）：** [`prd-peak-offpeak-pricing.md`](./prd-peak-offpeak-pricing.md) + [`design-peak-offpeak-pricing.md`](./design-peak-offpeak-pricing.md)  
> 说明：产品已改为新增 `peak_offpeak` 计费类型，避免改动既有 `tiered_expr` / `ratio` / `per_duration`。本文档保留为「在表达式内实现时段价」的可选高级方案参考，**不再作为 DeepSeek 峰谷的 MVP 交付范围**。

---

## 1. Executive Summary

### Problem Statement

上游厂商（以 DeepSeek 为先）已从一口价改为**峰谷分时计价**：高峰时段单价为闲时的 2 倍（闲时为高峰的一半）。高峰为北京时间每日 **09:00–12:00、14:00–18:00**，其余为空闲时段；缓存命中 / 缓存未命中 / 输出三项同步缩放。

当前阶梯计费表达式引擎虽已暴露 `hour()` / `minute()` 等函数，且可视化编辑器可用「请求规则」做**单一夜间折扣**，但无法作为产品能力落地峰谷价：

1. 可视化模式不能配置**多段不连续白天窗口**（现有 `range` 只生成跨午夜条件 `hour >= A || hour < B`）。
2. `hour()` 在预扣与结算时各自调用 `time.Now()`，长请求跨过窗口边界时预扣与实扣可能不一致。
3. 消费日志只记录 `matched_tier`，不记录命中的时段；公开定价页也无法同时展示峰 / 谷两套单价与生效窗口。
4. 没有 DeepSeek 官方价表预设，管理员只能手写表达式，易写错边界与时区。

### Proposed Solution

**不新增计费模式。** 继续使用 `tiered_expr`：「一条表达式即计费合同」。把时段作为档位选择条件，用 `tier("peak", …)` / `tier("off_peak", …)` 写出各窗口的绝对单价（$/1M tokens）。

配套补齐四件事：

1. **冻结计费时钟**：预扣时把求值时刻写入 `BillingSnapshot`，结算必须用同一时刻，禁止再读墙钟。
2. **可视化时段价**：在阶梯编辑器中配置时区 + 多段 `[start, end)` 窗口 + 每段价表（或相对基准段的倍率填表）。
3. **可审计展示**：日志记下命中档名、求值时刻、时区；定价页同时展示峰 / 谷价与窗口。
4. **官方预设**：DeepSeek V4 Flash / V4 Pro 峰谷价表（USD，$/1M tokens），生效口径与上游公告一致。

### Success Criteria

1. 管理员可为任意 `tiered_expr` 模型配置「北京时间 09:00–12:00 与 14:00–18:00 为高峰、其余为空闲、闲时价 = 高峰价 × 0.5」，保存后对后续请求立即生效。
2. 同一组 token（例如 Flash：`p=1e6, cr=0, c=1e6`）在冻结时刻为北京时间 10:00 时扣高峰价，在 13:00 时扣闲时价，且闲时配额精确为高峰的一半（验收数值见 §7）。
3. 预扣与结算使用同一冻结时刻；请求在 11:59 进入、12:01 返回时，实扣仍按 11:59 所属窗口，不得因结算跨窗改价。
4. 消费日志可看出本次命中 `peak` 或 `off_peak`（或管理员命名的等价档名），并带求值时刻；定价页能读出两套单价与窗口。
5. 未配置时段的既有阶梯表达式、夜间折扣请求规则、按 token / 按次 / 按时长模式行为零回归。

---

## 2. User Experience & Functionality

### User Personas

| 角色 | 诉求 |
|------|------|
| 系统管理员 | 按上游价卡为模型配置峰谷窗口与单价，最好有 DeepSeek 一键预设 |
| API 调用方 | 按**请求进入网关的时刻**被准确预扣；费用可预期，不因流式耗时跨窗而结算跳档 |
| 终端用户（定价页 / 消费日志） | 看清高峰 / 空闲两套价格，以及自己那次调用命中了哪一档 |

### User Stories

#### Story 1 — 管理员配置多段峰谷价

> As a 管理员, I want to 在阶梯计费可视化编辑器里为模型设置时区、多段每日时间窗口和每段单价, so that 计费与上游峰谷价卡一致，且不必手写 `hour()` 表达式。

**Acceptance Criteria**

- 仍走现有定价模式 **`tiered_expr`**（产品文案可称「按时段」为阶梯计费的一种配置，不新增第四种 billing mode）。
- 可视化模式增加 **时段定价** 区块，可配置：
  - **时区**：IANA 名称，默认 `Asia/Shanghai`（与现有时间规则一致）；非法时区**拒绝保存**，不得静默回退 UTC。
  - **时段列表**（≥ 1 个具名时段 + 1 个兜底时段）：
    - 名称（写入 `tier("name", …)`，如 `peak` / `off_peak`）。
    - 零或多段每日窗口，格式 `HH:mm`，半开区间 **`[start, end)`**。
    - 各计费变量单价（与现有可视化价表相同：`p` / `c` / `cr` / …）。
  - **兜底时段**（通常为空闲）：窗口留空，表示「未命中任一窗口」。
- 支持 **「按另一时段 × 倍率填表」**：例如以高峰价为基准，空闲 = ×0.5，避免三项价格各填一遍算错。倍率必须 `> 0`、有限、非 NaN。
- 多段窗口在同一时段内为 **OR**（DeepSeek 上午 ∪ 下午均为高峰）；不同具名时段不得重叠。重叠在保存时拒绝，并指出冲突窗口。
- 窗口可跨午夜（如 `21:00–06:00`），语义为 `tod >= start || tod < end`。DeepSeek 的两段白天窗口不跨午夜。
- 保存校验与现有表达式一致：编译通过，且用样本 token 烟测结果非负。
- 原始表达式模式仍可直接写 `hour()` / `minute()` /（若实现）`tod()`；可视化与原始模式往返不得丢失已识别的时段结构。

#### Story 2 — DeepSeek 峰谷预设

> As a 管理员, I want 一键套用 DeepSeek 官方峰谷价, so that 不必对照文档手填窗口和三项单价。

**Acceptance Criteria**

- 在现有预设分组 `Time-based`（或并列「Peak / off-peak」）增加至少：
  - `DeepSeek V4 Flash`（峰谷）
  - `DeepSeek V4 Pro`（峰谷）
- 窗口与时区固定为：
  - 时区 `Asia/Shanghai`
  - 高峰：`09:00–12:00`、`14:00–18:00`
  - 空闲：其余时间
- 单价采用上游 **USD / 1M tokens**（与表达式「系数即真价」一致）。对应上游公告（2026-08-16 16:00 UTC 起生效）如下。

| 模型 | 时段 | 输入缓存命中 `cr` | 输入缓存未命中 `p` | 输出 `c` |
|------|------|-------------------|---------------------|----------|
| deepseek-v4-flash | 空闲 | 0.007 | 0.22 | 0.66 |
| deepseek-v4-flash | 高峰 | 0.014 | 0.44 | 1.32 |
| deepseek-v4-pro | 空闲 | 0.022 | 0.66 | 1.98 |
| deepseek-v4-pro | 高峰 | 0.044 | 1.32 | 3.96 |

- 预设生成的表达式必须让 `tier()` 档名可区分高峰 / 空闲（推荐 `peak` / `off_peak`），以便日志高亮命中档。
- 预设只填充编辑器，**不**在未保存时改写线上价格；管理员仍须显式保存。
- 上游若改价，以官方价卡为准更新预设数字；本 PRD 锁定的是**时段机制**，价表数字可随预设迭代。

#### Story 3 — 按请求进入时刻计费（预扣 = 结算时钟）

> As a API 调用方, I want the gateway to freeze the billing clock when it accepts my request, so that a streaming call that crosses 12:00 is not repriced at settlement.

**Acceptance Criteria**

- **计费时刻** = 该请求首次进入阶梯预扣（创建 `BillingSnapshot`）时的瞬时。自动分组重试**不得**刷新该时刻（与表达式字符串冻结一致；分组相关字段仍可按现有规则刷新）。
- `hour` / `minute` / `weekday` / `month` / `day`（及新增的时刻辅助函数）在预扣与结算中必须读取快照内的冻结时刻，禁止 `time.Now()`。
- 边界（北京时间，半开区间）：

  | 冻结时刻 | 窗口 |
  |----------|------|
  | 08:59:59 | 空闲 |
  | 09:00:00 | 高峰 |
  | 11:59:59 | 高峰 |
  | 12:00:00 | 空闲 |
  | 13:59:59 | 空闲 |
  | 14:00:00 | 高峰 |
  | 17:59:59 | 高峰 |
  | 18:00:00 | 空闲 |

- 预扣估算与结算实扣允许因 **token 数量**不同而产生差额，**不允许**因时钟不同而产生差额。
- 任务类 / 异步通道若走 `tiered_expr`：同样在提交预扣时冻结；本需求不把「完成时刻」当作改价点。

#### Story 4 — 日志、定价页与对账

> As a 用户/管理员, I want pricing pages and usage logs to show peak vs off-peak prices and which window applied, so that charges are explainable.

**Acceptance Criteria**

- 消费日志 `other` 在现有 `billing_mode` / `expr_b64` / `matched_tier` 之外增加（字段名实现可微调，语义不可缺）：
  - `billing_eval_at`：冻结时刻 RFC3339（含时区偏移或同时给 Unix 秒 + IANA 时区）。
  - `matched_tier`：必须是 `peak` / `off_peak`（或管理员命名），**不得**在使用时段价时仍永远为 `base`。
- 用量详情里的动态价格拆解：同时列出各时段价表，并高亮本次命中档（复用现有 `matched_tier` 高亮）。
- 公开定价页：对含时段的模型展示「高峰窗口 + 高峰单价」与「空闲单价」，而不是只显示一套价再附一句难懂的 `hour() ≥ 9`。
- MVP **不要求**定价页按浏览者本地时间实时切换「当前为高峰」；若做，仅为展示提示，不得影响计费。

#### Story 5 — 与现有请求规则共存

> As a 管理员, I want existing night-discount and header/param multipliers to keep working, so that peak/off-peak does not break Fast mode / Priority 等规则。

**Acceptance Criteria**

- 现有 `Time-based` 预设「夜间 5 折」「周末 8 折」行为保持不变。
- 时段档位（`tier("peak")` / `tier("off_peak")`）与请求规则乘子是**正交**的：先按冻结时刻选档得到美元成本，再乘 `when(header…)` 等规则。
- 不把 DeepSeek 峰谷做成「基准价 × 请求规则 2 倍」作为唯一官方写法：那种写法会让 `matched_tier` 失去峰/谷语义。请求规则乘子仍允许用于「全天一口价 + 夜间打折」这类简单场景。

### Non-Goals（本版不做）

- 不新增独立 billing mode（如 `peak_offpeak`）；不替换表达式引擎。
- 不做按**周历例外**（节假日高峰、单日临时调价）的日历系统；仅每日重复窗口。
- 不做按 token 生成过程**分段**计费（前 N 秒高峰价、后 M 秒闲时价）。一次请求一个窗口。
- 不自动拉取 DeepSeek 官方价卡；预设为仓库内静态模板。
- 不改变 `per-token` / `per-request` / `per_duration` 模型，除非管理员主动改成 `tiered_expr`。
- 不在本需求中实现「用户侧错峰调度 / 排队到闲时再发」。

---

## 3. AI System Requirements

本需求非 AI 推理功能，本节不适用。

---

## 4. Technical Specifications

### Architecture Overview

```
Admin Editor (visual time windows + prices)
        │  generateExpr()
        ▼
options.ModelBillingExpr  （一条自包含表达式）
        │
        ▼
Pre-consume
  now = clock.Now()          ← 唯一取墙钟处
  snapshot.EvalUnix = now
  cost = RunExpr(expr, tokens, evalAt=now)
        │
        ▼
Upstream relay (stream / non-stream)
        │
        ▼
Settle
  cost = RunExpr(expr, actualTokens, evalAt=snapshot.EvalUnix)
  差额多退少补（仅因 token，不因时间）
        │
        ▼
Log: matched_tier + billing_eval_at + expr_b64
```

与现有能力的关系：

| 能力 | 现状 | 本需求 |
|------|------|--------|
| `hour(tz)` 等 | 已有，内部 `time.Now()` | 改为读取注入的冻结时刻 |
| 请求规则时间条件 | 仅适合单段夜间 `range` | 保留；峰谷主路径改为 `tier()` 档位 |
| `BillingSnapshot` | 冻表达式与请求体，不冻时钟 | 增加 `EvalUnix`（或等价） |
| `parseTiersFromExpr` | 只识别 `p`/`c`/`len` 条件 | 识别时段条件或时段档名，供定价页展示 |
| 预设 | Night discount / Weekend | 增加 DeepSeek Flash / Pro 峰谷 |

### 推荐表达式形态（Flash 验收金样）

可视化生成结果应等价于：

```
(
  (tod("Asia/Shanghai") >= 540 && tod("Asia/Shanghai") < 720) ||
  (tod("Asia/Shanghai") >= 840 && tod("Asia/Shanghai") < 1080)
)
  ? tier("peak",     p * 0.44 + c * 1.32 + cr * 0.014)
  : tier("off_peak", p * 0.22 + c * 0.66 + cr * 0.007)
```

其中 `tod(tz)` 为「该时区当天已过分钟数」，`[0, 1440)`：`09:00 → 540`，`12:00 → 720`，`14:00 → 840`，`18:00 → 1080`。

若 MVP 不新增 `tod()`，必须用 `hour(tz) * 60 + minute(tz)` 生成等价条件，**禁止**只用 `hour()` 而把 `12:00:00` 误判进高峰（`hour==12` 属于空闲）。

跨午夜窗口（既有夜间折扣）继续用：

```
tod(tz) >= start || tod(tz) < end
```

### 建议新增的表达式函数

| 函数 | 签名 | 作用 |
|------|------|------|
| `tod` | `tod(tz) → int` | 冻结时刻在 `tz` 下的分钟数 `hour*60+minute`，范围 0–1439 |

非法 / 空时区：与保存期校验一致，**求值期不得静默改用 UTC**（否则北京高峰会被错算成 UTC 窗口）。编译期或运行期应使该表达式保存失败；若历史表达式已含非法时区，求值应报错并走现有阶梯失败降级策略（不得按错误时区扣费）。此项相对现状（非法时区回退 UTC）是行为收紧，须在发布说明中写明。

`hour` / `minute` 等现有函数保留，全部改为基于同一冻结时刻。

### BillingSnapshot 扩展

```go
type BillingSnapshot struct {
    // …现有字段…
    EvalUnix int64  `json:"eval_unix"` // 秒，UTC
    EvalTZ   string `json:"eval_tz,omitempty"` // 可选，便于日志展示；计费以表达式内 tz 为准
}
```

- `EvalUnix == 0` 的旧快照（本功能上线前已预扣、上线后才结算的极窄窗口）：结算回退为结算时墙钟，并打 warn；新快照必须写入非 0。
- 单测必须覆盖「注入 2026-08-17 10:00 Asia/Shanghai」得到确定性高峰价，而不是依赖 `time.Now()`。

### Integration Points

| 层级 | 变更要点 |
|------|----------|
| `pkg/billingexpr/run.go` | `hour`/`minute`/…/`tod` 从 env 读取冻结 `time.Time`；`RunExpr*` 增加 `evalAt time.Time`（零值 = 调用方未传时仅用于非计费工具，生产路径必须传入） |
| `pkg/billingexpr/types.go` | `BillingSnapshot.EvalUnix` |
| `relay/helper/price.go` | 预扣创建快照时写入 `EvalUnix` |
| `service/tiered_settle.go` | 结算把 `EvalUnix` 注入 `RunExpr` |
| `service/log_info_generate.go` | `InjectTieredBillingInfo` 写入 `billing_eval_at` |
| 管理端 `tiered-pricing-editor.tsx` | 时段 UI、DeepSeek 预设、生成/回解析 |
| `web/src/features/pricing/lib/billing-expr.ts` | `tod` 窗口生成；`parseTiersFromExpr` 识别时段档 |
| 定价展示 / 用量详情 | 峰谷两套价 + 窗口文案 + 命中高亮 |
| `pkg/billingexpr/expr.md` | 文档补充时段约定、冻结时钟、`tod`、DeepSeek 样例 |

### 与长度阶梯组合

MVP 允许「先按时段选价表，再按 `len` 选档」或反过来，但可视化若两者同时开启，生成的是笛卡尔积（如 peak+standard / peak+long / off_peak+standard / off_peak+long）。

- MVP：**允许**原始表达式手写笛卡尔积；可视化若同时开启时段与长度档，须明确生成 2×N 个 `tier()` 名称（如 `peak_standard`），或在 UI 上提示「请用原始模式」。
- 推荐 MVP 可视化约束：时段定价与多长度档**不同时**在可视化里深度嵌套，避免编辑器过复杂。DeepSeek 预设无长度档，不受影响。

### Security & Privacy / Billing Safety

- 遵循 AGENTS.md 计费不变量：单价与倍率 `> 0`、有限；配额换算走 `common.QuotaFrom*Checked`；禁止负数扣费。
- 时段条件只依赖冻结时钟与配置，不读取用户可控的请求字段来「选择更便宜的窗口」。
- 价格配置仍为管理员能力；不新增普通用户可写改价接口。
- 日志中的求值时刻是业务审计字段，不含额外 PII。

---

## 5. Risks & Roadmap

### Phased Rollout

| 阶段 | 内容 |
|------|------|
| **MVP** | 冻结时钟；`tod()`（或等价生成）；可视化多段窗口 + 兜底价表；DeepSeek Flash/Pro 预设；日志 `matched_tier` + `billing_eval_at`；定价页展示两套价；边界单测（§7） |
| **v1.1** | 可视化同时支持「长度档 × 时段」笛卡尔积；定价页「当前窗口」提示；非法时区从运行期 UTC 回退全面改为保存期拒绝 |
| **v2.0** | 可选：节假日/例外日日历；按完成时刻重计价（默认仍不启用） |

### Technical Risks

| 风险 | 影响 | 缓解 |
|------|------|------|
| 预扣与结算各读一次 `Now()` | 跨 12:00 / 18:00 的流式请求错档，商户或平台资损 | 快照冻时钟；加跨窗集成测试 |
| 只用 `hour()` 表达 09:00–12:00 | `12:00–12:59` 被算进高峰 | 半开区间 + `tod`/`minute`；边界表驱动测试 |
| 请求规则 ×2 实现峰谷 | 日志永远 `base`，对账看不出峰谷 | 预设与可视化主路径用 `tier("peak")` |
| 非法时区回退 UTC | 北京高峰被当成 UTC 01:00 窗口错配 | 保存拒绝；求值失败优于错扣 |
| 可视化往返解析失败 | 管理员一保存表达式被改坏 | 生成器与 `tryParseVisualConfig` 成对单测，DeepSeek 预设必须可回解析 |
| 自动分组重试刷新了时钟 | 重试跨窗改价 | 明确 `EvalUnix` 与表达式一同冻结 |

### Open Questions（请确认）

1. **计费时钟锚点**：MVP 按「首次预扣时刻」。是否有通道必须改成「上游 `created` / 首 token」？
2. **旧快照**：上线瞬间已预扣、尚未结算的请求，回退墙钟是否可接受？（预期极少）
3. **可视化笛卡尔积**：MVP 是否禁止「长度档 + 时段」同时可视化编辑，只允许原始表达式？
4. **非法时区**：历史已保存的 `hour("Invalid/Zone")` 表达式，上线后是求值失败还是继续 UTC 回退？
5. **人民币价卡**：部分国内转载给出 Flash 高峰 ¥3 / ¥9 等人民币价。系统表达式口径是 USD；定价页按站点汇率展示人民币即可，还是需要人民币预设？

---

## 6. 测试计划（验收）

必须使用可注入时钟，禁止依赖真实 `time.Now()` 断言峰/谷。

- **单元（`pkg/billingexpr`）**
  - 冻结 `2026-08-17 10:00:00 +08:00` → Flash 高峰价；`13:00` → 闲时价，且闲时 = 高峰 × 0.5。
  - 边界：08:59:59、09:00:00、11:59:59、12:00:00、13:59:59、14:00:00、17:59:59、18:00:00。
  - 预扣与结算传入同一 `EvalUnix`、不同 token → 仅 token 导致差额。
  - 预扣 11:59、若错误地在结算改用 12:01 会得到不同档——回归测试锁定「不得发生」。
  - `tod("Asia/Shanghai")` 与 `hour*60+minute` 一致；跨午夜窗口与现有 night-discount 等价。
- **前端**
  - DeepSeek 预设 → 可视化可回解析 → `build` 出的表达式含两段高峰窗口与两套单价。
  - 重叠窗口拒绝保存；空闲倍率 0.5 填表后 `cr/p/c` 均为高峰一半。
  - 定价拆解展示 peak / off_peak 两行。
- **回归**
  - 无时段的 Claude / GPT 阶梯表达式扣费不变。
  - 夜间 5 折请求规则仍可保存与求值。
  - `per_duration` / 按次 / 按 token 不受影响。
- **relaykit**：若本改动进入 `relaykit/` 公共 API，须 `cd relaykit && GOWORK=off go build ./...`。当前 `billingexpr` 在根模块，预期不触及。

---

## 7. 公式与示例（规格摘要）

```
evalAt = snapshot.EvalUnix          // 预扣写入，结算只读
tod    = minutes_since_midnight(evalAt in expr timezone)

is_peak = (tod ∈ [09:00, 12:00) ∪ [14:00, 18:00))   // Asia/Shanghai for DeepSeek

costUSD = is_peak ? peak_prices(tokens) : off_peak_prices(tokens)
quota   = convert(costUSD)          // 现有 QuotaPerUnit × groupRatio
```

**Flash 数值验收**（groupRatio = 1，忽略缓存创建；单位 $/1M tokens，表达式输出为「美元 × token/1e6」）：

| 冻结时刻 (CST) | p | cr | c | 期望 expr 输出 |
|----------------|---|----|---|----------------|
| 10:00 高峰 | 1_000_000 | 0 | 1_000_000 | `0.44 + 1.32 = 1.76` |
| 13:00 空闲 | 1_000_000 | 0 | 1_000_000 | `0.22 + 0.66 = 0.88` |
| 10:00 高峰 | 0 | 1_000_000 | 0 | `0.014` |
| 13:00 空闲 | 0 | 1_000_000 | 0 | `0.007` |

空闲行必须严格等于对应高峰行的 1/2。

**Pro 同构**：高峰 `p*1.32 + c*3.96 + cr*0.044`，空闲为共一半。

---

## 8. 现状对照（实现时勿重复造轮子）

已存在、应复用：

- 表达式函数 `hour` / `minute` / `weekday` / `month` / `day`（`pkg/billingexpr/run.go`）
- 可视化请求规则时间条件与 `Time-based` 预设（夜间 / 周末）
- `tier()` 命中档写入日志 `matched_tier`
- 表达式编译缓存、预扣快照、结算重放

必须新增 / 修正：

- 求值时钟冻结
- 多段白天窗口的可视化与 `tod`（或等价）
- DeepSeek 峰谷预设（档位式，而非全局 ×2）
- 解析器与定价页理解时段档
- 用注入时钟的确定性测试替换「现在是不是晚上」式断言（现有 `TestTimeFunctions_NightDiscountPattern` 接受 7000 或 3500 两种结果，不足以锁峰谷合同）
