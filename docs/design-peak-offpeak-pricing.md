# 详细设计：峰谷定价计费类型（`peak_offpeak`）

> 状态：已实现（MVP）  
> 日期：2026-09-03（修订：可配置工作时间 + 模型广场展示；默认时区 `Asia/Shanghai`；2026-09-04 落地实现）  
> 需求：[PRD：峰谷定价（Peak / Off-peak）计费类型](./prd-peak-offpeak-pricing.md)  
> 参考实现：`setting/billing_setting/duration_pricing.go`（独立模式 + 专属配置表）、`relay/helper/price.go`（模式分支）、`service/tiered_settle.go`（预扣快照 + 结算差额）、`web/src/features/pricing/*`（模型广场 `per_duration` / `tiered_expr` 展示模式）、`pkg/billingexpr`（token 变量语义，**只复用概念不耦合表达式引擎**）  
> 上游：[DeepSeek Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/)

---

## 0. 可行性结论

**可行，按新增 `billing_mode = peak_offpeak` 落地。**

与在 `tiered_expr` 内扩展时段可视化相比：独立模式更贴近 `per_duration` 的成功先例（结构化配置、独立分支、旧模式零触碰），满足「新增计费类型且不影响既存计费」的硬约束。

| 维度 | 评估 |
|------|------|
| 技术可行性 | 高：预扣/结算/配额换算链路可复用；窗口判定为纯函数 |
| 业务必要性 | 高：DeepSeek 官方已实施峰谷 + 周末全谷 |
| 实现成本 | 中：后端配置 + 预扣结算 + 日志定价约 10–15 文件；前端定价表单约 6–10 文件 |
| 迁移风险 | 低：默认不启用；仅显式切换 mode 的模型进入新路径 |
| 替代方案 | 扩展 `tiered_expr` —— 否决为 MVP 主路径（见 PRD §8）；可作后续高级能力 |

**本设计锁定的 PRD 开放项：**

| 开放项 | 实现结论（MVP） |
|--------|-----------------|
| 配置时区口径 | **默认与 DeepSeek 预设均使用 `Asia/Shanghai`**，峰窗为 `09:00–12:00` / `14:00–18:00`（与官方 UTC `01:00–04:00` / `06:00–10:00` 等价）。管理员可改其它 IANA 时区。 |
| 旧快照 | 新模式使用独立快照结构（或扩展 `BillingSnapshot` 且 `BillingMode=peak_offpeak`）。`EvalUnix==0` 的异常快照：结算回退墙钟并 `SysError`/`LogWarn`，不得静默错档而不留痕。 |
| 人民币价卡 | MVP 仅 USD；定价页沿用站点汇率展示。 |
| 与旧 PRD | MVP **不**改 `tiered_expr` 可视化；不阻塞本功能。 |

---

## 1. 问题与背景

### 1.1 现状计费模式

```text
ModelPriceHelper / Task billing
       │
       ├─ (default) ratio / ModelPrice     ← 按 token 比值或按次
       ├─ tiered_expr                      ← 表达式引擎
       ├─ per_duration                     ← size × 秒
       └─ （无）峰谷结构化模式
```

DeepSeek 价卡需要：**多段每日窗口 × 工作日约束 × 两套绝对 $/1M 价 × 冻结请求时刻**。

### 1.2 为何不复用 `tiered_expr` 作为产品主路径

| 点 | 说明 |
|----|------|
| 产品诉求 | 明确要求「增加新的计费类型」 |
| 隔离 | 改表达式时钟/可视化会波及所有阶梯用户；独立 mode 分支可做到 diff 局部化 |
| 配置 UX | 官方价卡是两行价表 + 窗口，不是长度阶梯 AST |
| 审计 | `matched_tier=peak\|off_peak` 与结构化配置 hash 比 base64 表达式更直观 |

高级用户仍可继续用 `tiered_expr` 手写等价逻辑；**产品预设与默认 DeepSeek 接入走 `peak_offpeak`**。

---

## 2. 目标与非目标

### 2.1 目标

1. 注册 `BillingModePeakOffPeak = "peak_offpeak"`。
2. 存储/校验/下发 `PeakOffPeakConfig`；**`PeakWindows` / 时区 / `WeekdaysOnly` 均由管理员配置驱动**，DeepSeek 三模型仅为静态预设填充值。
3. 文本请求预扣与结算按冻结时刻 + **当前配置窗口**选价表，配额走现有 `QuotaPerUnit` × `groupRatio`。
4. 日志可解释峰/谷；**模型广场**列表与详情展示峰谷价与工作时间。
5. `ratio` / `tiered_expr` / `per_duration` 零回归。

### 2.2 非目标

- 不修改 `pkg/billingexpr` 的 `hour()` 墙钟行为（可选后续独立 PR）。
- 不做任务类视频的峰谷（除非该模型被设为 `peak_offpeak` 且走文本 token 结算；MVP 聚焦 chat/completions 类文本用量）。
- 不自动同步官方价卡。

---

## 3. 架构总览

```text
Admin UI (Peak/Off-peak form + DeepSeek presets)
        │  save options
        ▼
billing_setting.billing_mode[model] = "peak_offpeak"
billing_setting.peak_offpeak_pricing[model] = PeakOffPeakConfig
        │
        ▼
ModelPriceHelper
  if mode == peak_offpeak:
      evalAt = now
      period = ResolvePeriod(cfg, evalAt)          // peak | off_peak
      costUSD = Estimate(cfg, period, estTokens)
      snapshot = PeakOffPeakSnapshot{EvalUnix, ConfigHash, Period, ...}
      return PriceData{QuotaToPreConsume, ...}
        │
        ▼
Upstream relay
        │
        ▼
PostTextConsumeQuota / TryPeakOffPeakSettle
  period = ResolvePeriod(cfg, snapshot.EvalUnix)  // 禁止 Now()
  costUSD = Settle(cfg, period, actualTokens)
  差额多退少补
        │
        ▼
Log: billing_mode + matched_tier + billing_eval_at
Pricing API: peak_offpeak_pricing public DTO
Model Plaza (/pricing): badge + list summary + detail windows/prices
```

**隔离原则：** `ModelPriceHelper` 在现有 `tiered_expr` 判断旁增加 `else if peak_offpeak`；`ratio` 默认路径与 `per_duration` 任务路径不改控制流语义。峰窗判定**只读配置**，不读全局硬编码常量。

---

## 4. 数据模型

### 4.1 配置（options）

```go
// setting/billing_setting/peak_offpeak.go

const (
    BillingModePeakOffPeak     = "peak_offpeak"
    PeakOffPeakPricingField    = "peak_offpeak_pricing"
)

type TimeWindow struct {
    Start string `json:"start"` // "HH:mm"，本地时区
    End   string `json:"end"`   // 半开区间 [start, end)
}

type PeakOffPeakTokenPrices struct {
    CacheHit   float64 `json:"cache_hit"`   // $/1M → cr
    CacheMiss  float64 `json:"cache_miss"`  // $/1M → p
    Completion float64 `json:"completion"`  // $/1M → c
    // MVP 可选 omitempty，未配置则不参与单独计价：
    CacheCreation *float64 `json:"cache_creation,omitempty"`
    Image         *float64 `json:"image,omitempty"`
    AudioIn       *float64 `json:"audio_in,omitempty"`
    AudioOut      *float64 `json:"audio_out,omitempty"`
}

type PeakOffPeakConfig struct {
    Timezone     string                 `json:"timezone"`       // IANA，必填；表单默认 Asia/Shanghai
    WeekdaysOnly bool                   `json:"weekdays_only"`  // true: 周末强制 off_peak
    PeakWindows  []TimeWindow           `json:"peak_windows"`   // 至少 1 段；默认 09:00-12:00, 14:00-18:00
    Peak         PeakOffPeakTokenPrices `json:"peak"`
    OffPeak      PeakOffPeakTokenPrices `json:"off_peak"`
}
```

```go
const DefaultPeakOffPeakTimezone = "Asia/Shanghai"
```

挂入现有 `BillingSetting`：

```go
type BillingSetting struct {
    BillingMode         map[string]string
    BillingExpr         map[string]string
    DurationPricing     map[string]DurationPriceConfig
    PeakOffPeakPricing  map[string]PeakOffPeakConfig `json:"peak_offpeak_pricing"`
}
```

`GetPricingSyncData` 增加下发 `peak_offpeak_pricing`，供管理端与**模型广场**公开定价组装。

**硬约束：工作时间可配置**

- 计费与展示路径**禁止**写死 DeepSeek 的默认窗口为不可改常量。
- `ResolvePeriod` 只读取 `cfg.PeakWindows` + `cfg.Timezone` + `cfg.WeekdaysOnly`。
- **新建表单 / 空配置默认时区 = `Asia/Shanghai`**（常量 `DefaultPeakOffPeakTimezone`）。
- DeepSeek 预设填充值：
  1. `timezone: Asia/Shanghai`
  2. 窗口 `09:00–12:00`、`14:00–18:00`
  3. 仅出现在管理端「套用预设」与文档/单测 fixture
- 单测必须包含「非 DeepSeek 窗口」用例，防止回归成硬编码。

### 4.2 校验规则

`ValidatePeakOffPeakConfig(cfg) error`：

1. `timezone` 可被 `time.LoadLocation` 加载，否则拒绝。
2. `len(PeakWindows) >= 1`。
3. 每个窗口 `HH:mm` 可解析；允许跨午夜；同列表两两不可重叠（展开到分钟集合或区间合并检测）。
4. `Peak` / `OffPeak` 的 `CacheHit` / `CacheMiss` / `Completion` 均 `> 0` 且有限（`AddOtherRatio` 同级守卫）。
5. 可选指针字段若非 nil，同样 `> 0` 有限。

保存入口（与 duration / expr 烟测同级）在更新 options 前调用校验。

### 4.3 运行时快照

优先**扩展**现有 `billingexpr.BillingSnapshot`（已有 `BillingMode` 字段），避免再引入第二套 relayInfo 指针：

```go
type BillingSnapshot struct {
    // …既有字段…
    EvalUnix   int64  `json:"eval_unix"`
    EvalTZ     string `json:"eval_tz,omitempty"`
    MatchedPeriod string `json:"matched_period,omitempty"` // "peak" | "off_peak"
    // peak_offpeak 可不填 ExprString；ConfigJSON/ConfigHash 可选
    ConfigHash string `json:"config_hash,omitempty"`
}
```

或在 `relaycommon.RelayInfo` 增加 `PeakOffPeakSnapshot *PeakOffPeakSnapshot`。  
**MVP 推荐：** 复用 `TieredBillingSnapshot` 槽位但 `BillingMode=peak_offpeak`，结算函数按 mode 分流（`TryTieredSettle` 开头已有 mode 检查，互不干扰）。更清晰的做法是新字段 `BillingSnapshot` 通用化——若改动面大，则新字段 `PeakOffPeakBillingSnapshot`，**禁止**让 `TryTieredSettle` 误处理峰谷快照。

**锁定：MVP 使用独立字段**

```go
// relay/common/relay_info.go
PeakOffPeakSnapshot *peakoffpeak.Snapshot
```

```go
// pkg/peakoffpeak/types.go  （新小包，根模块内；勿放入 relaykit）
type Snapshot struct {
    BillingMode               string
    ModelName                 string
    Config                    PeakOffPeakConfig // 或序列化副本
    ConfigHash                string
    EvalUnix                  int64
    EstimatedPeriod           string // peak | off_peak
    GroupRatio                float64
    QuotaPerUnit              float64
    EstimatedQuotaAfterGroup  int
    // token 估算字段按需
}
```

独立包的好处：零改动 `billingexpr` 公共行为，满足隔离。

---

## 5. 核心算法

### 5.1 窗口判定

```go
func ResolvePeriod(cfg PeakOffPeakConfig, evalAt time.Time) (string, error) {
    loc, err := time.LoadLocation(cfg.Timezone)
    if err != nil {
        return "", err // 不得回退 UTC
    }
    local := evalAt.In(loc)
    if cfg.WeekdaysOnly {
        wd := local.Weekday()
        if wd == time.Saturday || wd == time.Sunday {
            return "off_peak", nil
        }
    }
    tod := local.Hour()*60 + local.Minute()
    for _, w := range cfg.PeakWindows {
        if inWindow(tod, w) { // 半开；跨午夜用 OR 语义
            return "peak", nil
        }
    }
    return "off_peak", nil
}
```

`inWindow`：

- 同日：`start <= end` → `tod >= start && tod < end`
- 跨午夜：`start > end` → `tod >= start || tod < end`

秒级边界：以分钟粒度配置时，`04:00:00` 的 `tod` 为 `4*60=240`，若窗口为 `[60, 240)` 则恰为空闲，与官方半开语义一致。若需秒级精确，MVP 仍按分钟配置足够（官方窗口为整点）。

### 5.2 成本计算

Token 输入建议结构与 `billingexpr.TokenParams` 对齐，便于复用 usage 归一化：

```go
costUSD = (
    p   * prices.CacheMiss +
    cr  * prices.CacheHit +
    c   * prices.Completion +
    optional...
) / 1e6
```

**Usage 归一化：**

- 从 `PostTextConsumeQuota` 已有的 `effectiveBillingUsage` / Claude vs OpenAI semantic 入手，抽出或复用「按已用变量从 `p`/`c` 排除子类」的逻辑。
- MVP 固定使用 `p`/`cr`/`c`（若响应无 cache 字段则 `cr=0`，cache 留在 `p` 内——与「表达式未声明 cr」行为一致：若价表始终给了 `cache_hit`，则应声明使用 `cr` 并从 `p` 扣除，与 DeepSeek 价卡一致）。

**锁定：MVP 始终按三变量计价**（价表必填三项），因此始终从 prompt 中拆出 cache read（在 usage 提供时），与 DeepSeek 官方分项一致。

### 5.3 配额

```go
quotaBeforeGroup = costUSD * QuotaPerUnit
quotaAfterGroup  = QuotaFromFloatChecked(quotaBeforeGroup * groupRatio)
```

禁止裸 `int(...)` 转换；饱和写入 `relayInfo.QuotaClamp` + `attachQuotaSaturation`。

### 5.4 预扣估算

文本预扣时 completion 未知：与 `tiered_expr` 类似，使用 `max_tokens` 或系统默认预估 completion；结算按实际上游 usage 多退少补。

---

## 6. 集成点（按文件）

### 6.1 后端

| 文件 | 变更 |
|------|------|
| `setting/billing_setting/tiered_billing.go` | 增加常量；`BillingSetting` 字段；`GetPricingSyncData` |
| `setting/billing_setting/peak_offpeak.go`（新） | CRUD 访问器、Validate、DeepSeek 预设常量（可选） |
| `pkg/peakoffpeak/`（新） | `ResolvePeriod`、`CalcCostUSD`、`Snapshot`、纯函数单测 |
| `relay/helper/price.go` | `ModelPriceHelper`：`peak_offpeak` 分支 → `modelPriceHelperPeakOffPeak` |
| `service/peak_offpeak_settle.go`（新） | `TryPeakOffPeakSettle`；在 `PostTextConsumeQuota` 中与 `TryTieredSettle` 并列调用 |
| `service/text_quota.go` | 结算入口分支；工具附加费若存在则与阶梯同样叠加 |
| `service/log_info_generate.go` | `InjectPeakOffPeakBillingInfo` |
| `model/pricing.go` | 公开 `PeakOffPeakPricing` DTO（**模型广场必依赖**） |
| `controller` options 保存 | 校验 `peak_offpeak_pricing`（若通用 map 合并已够，则在 setter 钩子校验） |

### 6.2 前端 — 管理端

| 文件 | 变更 |
|------|------|
| `model-pricing-core.ts` | `PricingMode` 增加 `peak_offpeak`；默认 DeepSeek 表单值 |
| `model-pricing-sheet.tsx` | 新 `TabsTrigger` / `TabsContent` |
| `model-ratio-visual-editor.tsx` | 模式计数、保存 map |
| `model-pricing-snapshots.ts` | 快照标签「Peak / Off-peak」 |
| 新组件 `peak-offpeak-pricing-form.tsx` | 时区、开关、**可增删改的峰窗列表**、双价表、倍率填表、预设下拉 |

### 6.3 前端 — 模型广场（`/pricing`，MVP 必做）

对照现有 `per_duration` / `tiered_expr` 展示模式接入，避免只改 badge 不改价格。

| 文件 | 变更 |
|------|------|
| `features/pricing/types.ts` | `PricingModel` 增加 `peak_offpeak_pricing?: { timezone, weekdays_only, peak_windows, peak, off_peak }` |
| `features/pricing/lib/model-helpers.ts` | `isPeakOffPeakModel(model)` |
| `features/pricing/lib/peak-offpeak-price.ts`（新） | 格式化峰/谷摘要、窗口文案；复用 `formatPrice` / 分组倍率 / 汇率 |
| `model-billing-mode-badge.tsx` | 新增分支：label `Peak / Off-peak`（i18n「峰谷定价」） |
| `pricing-columns.tsx` | Price 列：峰谷模型走摘要（高峰/空闲输入+输出），勿落默认 `-` |
| `model-card.tsx` | 卡片价格区展示峰谷摘要 + badge |
| `model-details.tsx` | 详情区块：工作时间窗口表 + 峰/谷价表（缓存命中/未命中/输出） |
| i18n | 「峰谷定价」「高峰」「空闲」「Peak hours」等键全语言补齐 |
| `features/usage-logs/*` | 详情中 `billing_mode === 'peak_offpeak'` 展示命中档 |

**列表摘要建议文案（可微调，信息不可缺）：**

```text
Peak in $0.44 / out $1.32 · Off-peak in $0.22 / out $0.66
```

或两行短标签。详情页必须列出配置中的全部 `peak_windows`（默认展示如 `09:00–12:00 Asia/Shanghai`）与 `weekdays_only` 说明。

**数据依赖：** `model/pricing.go` 在 `BillingModePeakOffPeak` 时写入公开 DTO；若配置缺失或校验失败，该模型**不要**伪装成 token 计价，可降级为仅显示 mode（并打日志），但正常保存路径必须带齐价表。

### 6.4 明确不改（回归保护）

- `pkg/billingexpr/run.go` 时间函数（MVP）
- `service/tiered_settle.go` 逻辑（仅确保 mode 守卫仍排除非 `tiered_expr`）
- `setting/billing_setting/duration_pricing.go` / 任务 `per_duration` 路径
- 默认 `ratio` 分支算术
- 模型广场其它 mode 的摘要分支顺序：先识别 `peak_offpeak`，再 `tiered_expr` / `per_duration` / token，避免误入 Dynamic Pricing。

---

## 7. DeepSeek 预设（代码常量）

```go
var DeepSeekV4FlashPeakOffPeak = PeakOffPeakConfig{
    Timezone:     "Asia/Shanghai",
    WeekdaysOnly: true,
    PeakWindows: []TimeWindow{
        {Start: "09:00", End: "12:00"},
        {Start: "14:00", End: "18:00"},
    },
    Peak: PeakOffPeakTokenPrices{
        CacheHit: 0.014, CacheMiss: 0.44, Completion: 1.32,
    },
    OffPeak: PeakOffPeakTokenPrices{
        CacheHit: 0.007, CacheMiss: 0.22, Completion: 0.66,
    },
}
// Pro: 0.044/1.32/3.96 与 0.022/0.66/1.98
// Vision Exp: 同 Flash
```

前端新建表单与预设的默认时区必须为 `Asia/Shanghai`；与后端常量数字、窗口一致。

---

## 8. API / 配置契约

### 8.1 管理端保存（示意）

```json
{
  "billing_setting.billing_mode": {
    "deepseek-v4-flash": "peak_offpeak"
  },
  "billing_setting.peak_offpeak_pricing": {
    "deepseek-v4-flash": {
      "timezone": "Asia/Shanghai",
      "weekdays_only": true,
      "peak_windows": [
        {"start": "09:00", "end": "12:00"},
        {"start": "14:00", "end": "18:00"}
      ],
      "peak": {"cache_hit": 0.014, "cache_miss": 0.44, "completion": 1.32},
      "off_peak": {"cache_hit": 0.007, "cache_miss": 0.22, "completion": 0.66}
    }
  }
}
```

### 8.2 公开定价字段（示意）

```json
{
  "model_name": "deepseek-v4-flash",
  "billing_mode": "peak_offpeak",
  "peak_offpeak_pricing": {
    "timezone": "Asia/Shanghai",
    "weekdays_only": true,
    "peak_windows": ["09:00-12:00", "14:00-18:00"],
    "peak": {"cache_hit": 0.014, "cache_miss": 0.44, "completion": 1.32},
    "off_peak": {"cache_hit": 0.007, "cache_miss": 0.22, "completion": 0.66}
  }
}
```

### 8.3 消费日志 `other`

```json
{
  "billing_mode": "peak_offpeak",
  "matched_tier": "off_peak",
  "billing_eval_at": "2026-09-05T02:00:00Z"
}
```

字段名 `matched_tier` 复用现有前端高亮，取值 `peak` / `off_peak`。

---

## 9. 测试设计

### 9.1 `pkg/peakoffpeak` 单测（表驱动）

- 窗口边界全集（PRD Story 3 表）
- 周末强制空闲
- `weekdays_only=false` 周末峰窗
- 跨午夜窗口
- **自定义工作时间**（非 DeepSeek 窗口）改档断言
- Flash/Pro 成本样例（PRD §7）
- 非法时区误差
- 重叠窗口校验

### 9.2 集成

- `relay/helper`：mode=`peak_offpeak` 时写入 snapshot 且 `EvalUnix != 0`
- `service`：预扣 09:59 结算不得改用 10:01
- 改 `PeakWindows` 后同一 `EvalUnix` 命中档随配置变化
- 工具附加费叠加（若文本路径有）不产生负配额

### 9.3 模型广场

- `isPeakOffPeakModel` + 摘要格式化单测（含 1K/1M、group ratio）
- badge / columns / card 对 fixture 模型不渲染 `-`
- details 渲染窗口与双价表（可用 RTL 组件测）
- 其它 billing mode 展示回归

### 9.4 回归（必须）

- `tiered_expr` 既有测试全绿
- `per_duration` 既有测试全绿
- `ratio` 样例模型价格 helper 结果不变
- 前端：未选峰谷时保存 payload 不含错误 mode

### 9.5 relaykit

本功能落在根模块 `pkg/peakoffpeak` + `setting` + `service`；**不**改 `relaykit/`。若误引入依赖，执行 `cd relaykit && GOWORK=off go build ./...` 护栏。

---

## 10. 实现顺序（建议）

1. **后端纯函数包** `pkg/peakoffpeak` + 校验 + 单测（含自定义窗口）
2. **billing_setting** 存储与 PricingSync / 公开定价 DTO
3. **预扣分支** `modelPriceHelperPeakOffPeak`
4. **结算分支** `TryPeakOffPeakSettle` 接入 `PostTextConsumeQuota`
5. **日志**
6. **管理端表单**（可编辑峰窗 + 预设 + i18n）
7. **模型广场** badge + 列表/卡片摘要 + 详情页（与步骤 2 DTO 对齐）
8. **全量回归** 旧三模式 + DeepSeek 验收表 + 自定义窗口 + 广场展示

---

## 11. 回滚与兼容

- 回滚代码：未切换 mode 的模型无感；已切换模型回退到上版二进制前，可将 mode 改回 `ratio`/`tiered_expr`。
- 配置向前兼容：未知字段 `omitempty`；旧进程忽略新 options key。
- 不写 DB schema migration（沿用 options JSON）。

---

## 12. 附录：官方窗口换算

| Asia/Shanghai（产品默认/预设） | UTC（官方文档原文） |
|-------------------------------|---------------------|
| Mon–Fri 09:00–12:00 | 01:00–04:00 |
| Mon–Fri 14:00–18:00 | 06:00–10:00 |
| 周末任意 | 全天空闲 |

来源：DeepSeek API Docs footnote — *Peak hours are 01:00 - 04:00 and 06:00 - 10:00 UTC, Monday through Friday (all other hours are off-peak). Off-peak rates are half of the peak rates.*

**产品约定：** 配置与预设默认使用左列（`Asia/Shanghai`）；与右列官方表述等价，不计费差异。
