# 详细设计：裂变报表（邀请消费现金返佣）

> 状态：P0 已实现（待联调）  
> 日期：2026-07-22  
> 对应需求：[prd-invite-fission-cashback.md](./prd-invite-fission-cashback.md)  
> 相对 PRD 的设计修订：  
> 1）基数事实表改为**每日凌晨增量/重算 upsert**，唯一键 `(period_month, user_id)`；  
> 2）报表打款金额按页面输入的 **rate 实时计算**，不在日更任务中落库应发金额。

---

## 1. 设计目标与原则

### 1.1 目标

1. 每日维护「被邀请人 × 自然月」的**付费承担消耗基数**（截止前一天）。
2. 管理端「报表 → 裂变报表」按邀请人聚合展示；**应发金额 = 基数 × 输入 rate**，查询/导出时实时计算。
3. 支持人工打款回写；与注册邀请 `AffQuota` 分账并行。
4. 结构上尽量遵守**开闭原则（OCP）**：新增额度来源、排除规则、报表列/导出格式时，优先扩展而非改核心编排。

### 1.2 相对 PRD 的关键差异

| 点 | PRD 原稿 | 本设计 |
|----|----------|--------|
| 数据生产 | 管理员点「生成账期」为主 | **每天凌晨自动更新**当月基数；页面以查/导出/打款为主 |
| 唯一键 | `(period, inviter_id)` 等结算行 | 事实表唯一键 **`(period_month, user_id)`**（`user_id` = 被邀请人） |
| rate | 生成时 `rate_snapshot` | **不落应发**；列表/导出用请求参数 rate 实时算 |
| 汇率 | 账期快照 | 日更时写入行级汇率快照，保证当月基数 CNY 稳定；rate 仍实时 |

### 1.3 开闭原则落点（总览）

| 扩展点 | 对修改封闭 | 对扩展开放 |
|--------|------------|------------|
| 额度入账分类 | 日更编排不写死 `if topup / if checkin...` | `CreditClassifier` 注册表 |
| 消耗是否计返佣 | 回放内核不写死订阅排除细节 | `ConsumeFilter` 链 |
| 日更调度 | Runner 不改 | 注册 `ScheduledSystemTaskHandler` |
| 报表打款金额 | 存储层只存基数 | `RewardCalculator`（rate 入参） |
| 导出格式 | 聚合查询稳定 | `Exporter` 实现 CSV/Excel |

---

## 2. 总体架构

```text
                    Asia/Shanghai 每天 00:05
                              │
                              ▼
              SystemTask: fission_daily_refresh
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
  CreditClassifier[]   ConsumeFilter[]     LedgerReplayer
  (付费/赠送入账)       (排除订阅等)         (赠送优先扣减)
         │                    │                    │
         └────────────────────┴────────────────────┘
                              │
                              ▼
              Upsert fission_user_month_stats
              UK: (period_month, user_id)
              字段: eligible_quota, base_cny, as_of_date, ...
                              │
                              ▼
         GET 裂变报表 ──► Aggregator(by inviter)
                              │
                              ▼
                    RewardCalculator(rate)  ← 页面输入，实时
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
                 列表/导出           标记已发放
                                    (冻结 rate + 金额)
```

### 2.1 分层（对齐本仓库习惯）

| 层 | 路径建议 | 职责 |
|----|----------|------|
| Router | `router/api-router.go` | `AdminAuth` 分组挂载 |
| Controller | `controller/fission_report.go` | 参数校验、HTTP、审计触发 |
| Service | `service/fission/` | 日更编排、回放、聚合、实时算奖、打款 |
| Model | `model/fission_*.go` | 表、Upsert、查询 |
| 前端 | `web/default/src/features/reports/fission/` | 裂变报表页 |

重逻辑放在 `service/fission`，避免 `controller` 直接堆台账；与 `service/rankings.go`、`service/system_task.go` 同类。

### 2.2 复用现网能力

| 能力 | 位置 | 用法 |
|------|------|------|
| 定时任务框架 | `service/system_task.go` + `controller/system_task_handlers.go` | 注册日更 Handler；主节点租约去重 |
| 邀请关系 | `model/user.go` `InviterId` | 仅 `inviter_id > 0` 的用户进入日更集合 |
| 消耗日志 | `model/log.go` `LogTypeConsume` | 回放出账；排除 `other.billing_source=subscription` |
| 资金来源常量 | `service/billing.go` `BillingSourceWallet` / `Subscription` | ConsumeFilter |
| 充值 | `model/topup.go` 成功单 | 付费入账（勿只信 topup 日志无 quota 字段） |
| 赠送 | checkin / redemption / 注册赠送 / 管理加款 | CreditClassifier |
| Upsert 范例 | `model/perf_metric.go` `OnConflict` | `(period_month, user_id)` 覆盖写 |
| CNY 折算 | `QuotaPerUnit` + `USDExchangeRate` | 日更写入 `base_cny` |
| 配额安全换算 | `common/quota_math.go` | 避免裸 `int` 截断 |
| JSON | `common.Marshal` / `Unmarshal` | 禁止业务直接 `encoding/json` 编解码 |

---

## 3. 核心领域模型

### 3.1 事实表：`fission_user_month_stats`（日更唯一键）

**语义**：被邀请人在某自然月、截止 `as_of_date`（含）的付费承担消耗汇总。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | PK | 自增 |
| `period_month` | string(`YYYY-MM`) | 账期月，上海时区 |
| `user_id` | int | **被邀请人** ID |
| `inviter_id` | int | 冗余邀请人，便于按邀请人聚合（日更时从 users 读取） |
| `eligible_quota` | int/bigint | 付费额度承担的消耗（quota 单位） |
| `base_cny` | decimal/string | 折合人民币基数（见汇率快照） |
| `quota_per_unit_snapshot` | float | 日更时点 |
| `usd_exchange_rate_snapshot` | float | 日更时点 |
| `as_of_date` | string(`YYYY-MM-DD`) | 已覆盖到的最后一天（上海） |
| `updated_at` | int64 | Unix |
| … | | 可选：`gift_consumed_quota` 审计字段 |

**唯一索引**：`uk_fission_period_user (period_month, user_id)`  

日更策略：**以最新全量结果覆盖**（`OnConflict DoUpdates` 整行替换基数相关列），而不是累加。原因：赠送优先台账路径依赖，昨日增量无法在无检查点时安全 `+`。

> 说明：唯一键中的 `user_id` 是被邀请人。邀请人维度的「应发/已发」见 §3.2，不与日更 UK 混用。

### 3.2 打款状态表：`fission_payout_records`

打款是邀请人维度动作，与 rate 实时预览分离。

| 字段 | 说明 |
|------|------|
| `period_month` + `inviter_id` | 唯一键 |
| `status` | `unpaid` / `held` / `paid` / `skipped_manual`（可选） |
| `paid_amount_cny` | 实际打款金额（标记时冻结） |
| `paid_rate` | 打款时使用的 rate（冻结） |
| `base_cny_at_pay` | 打款时基数快照（可选，防事后扯皮） |
| `voucher` / `remark` / `paid_at` / `operator_id` | 凭证与审计 |

未打款前：**不存**「应发金额」；列表上的应发一律实时算。

### 3.3 回放检查点（可选但推荐，OCP + 性能）

表 `fission_user_ledger_checkpoint`：

| 字段 | 说明 |
|------|------|
| `user_id` | UK |
| `gift_balance` / `paid_balance` | 虚拟台账余额 |
| `last_event_at` / `last_event_id` | 水位 |
| `as_of_date` | 已处理到的日历日 |

- **有检查点**：只消费水位之后事件，推进到「昨天」结束。  
- **无检查点 / 强制重建**：从开户起全量回放到昨天，再写检查点与月统计。  
- 日更默认：有检查点则增量；管理员「重建用户/整月」走全量。

首期若量级可控，可 MVP 仅全量回放至昨天并写 `fission_user_month_stats`，检查点作 P1。

### 3.4 配置

| 键 | 默认 | 说明 |
|----|------|------|
| `FissionReportEnabled` | true/false | 总开关；关则跳过日更 |
| `FissionDefaultRate` | `0.03` | 页面预填 |
| `FissionMinPayoutCNY` | `10` | 实时算后 &lt;10 展示为跳过 |
| `FissionTimezone` | `Asia/Shanghai` | |
| `FissionStartPeriod` | `2026-06` | 更早月不日更、不展示应发 |
| 日更时刻 | `00:05` | 与 Interval 实现见 §6 |

合规：`operation_setting.IsPaymentComplianceConfirmed()` 未确认则日更 no-op、管理接口拒绝写操作。

---

## 4. 开闭设计：插件化台账与计奖

包建议：`service/fission/`（或 `pkg/fission/` 若希望零依赖业务侧；优先 service 与现网一致）。

### 4.1 入账分类（Credit）

```go
// 伪代码：对扩展开放
type CreditKind int // Paid | Gift

type CreditEvent struct {
    UserID    int
    Quota     int
    OccurredAt int64
    Source    string // "topup","checkin",...
}

type CreditClassifier interface {
    Name() string
    // 从各自数据源拉取 [from, to] 事件；互不修改编排器
    ListCredits(ctx context.Context, userID int, from, to int64) ([]CreditEvent, error)
}
```

**内置实现（首期注册）**

| 实现 | 数据源 | Kind |
|------|--------|------|
| `TopupCreditClassifier` | `topups` status=success | Paid |
| `CheckinCreditClassifier` | `checkins` | Gift |
| `RedemptionCreditClassifier` | redemption 兑换成功 | Gift |
| `RegisterGiftCreditClassifier` | 系统日志/注册逻辑可追溯部分 | Gift |
| `AdminAddQuotaCreditClassifier` | manage 加款（默认 Gift） | Gift |
| `AffTransferCreditClassifier` | 需补日志或读划转记录；Gift | Gift |

编排器只遍历 `registry.Credits`，**新增来源 = 新 Classifier + Register**，不改 `LedgerReplayer`。

### 4.2 消耗过滤（Consume）

```go
type ConsumeEvent struct {
    UserID int
    Quota  int
    OccurredAt int64
    BillingSource string // wallet | subscription | ""
    RawOther json.RawMessage
}

type ConsumeFilter interface {
    Name() string
    Allow(ev ConsumeEvent) bool
}
```

首期过滤器：

- `ExcludeSubscriptionFilter`：`billing_source == subscription` → 拒绝  
- `WalletOnlyFilter`（可与上合并）

新增「排除测试渠道」等 → 新 Filter，不改回放核。

### 4.3 回放器（封闭修改）

```go
type LedgerReplayer struct {
    Credits []CreditClassifier
    Filters []ConsumeFilter
}

// ReplayTo 返回截至 toTs（含）的 gift/paid 余额，以及窗口内 eligible_quota
func (r *LedgerReplayer) ReplayTo(...) (eligibleQuota int, /* balances */, error)
```

规则（封闭）：事件按时间排序；入账加余额；出账**先 gift 后 paid**；仅 paid 扣减计入 `eligible_quota`。  
窗口外历史只推进余额，不计入当月 eligible（当月 eligible = 落在 `[monthStart, asOfEnd]` 的 paid 扣减和）。

### 4.4 实时计奖（封闭存储、开放 rate）

```go
type RewardInput struct {
    BaseCNY float64 // 来自聚合后的 base_cny
    Rate    float64 // 页面输入 (0,1] 或百分比转小数
    MinCNY  float64 // 10
}

type RewardResult struct {
    RawCNY    float64
    PayCNY    float64 // round 到分；不足门槛为 0
    Skipped   bool
}
```

- **查询/导出**：`PayCNY = RoundCents(BaseCNY * Rate)`，若 `< MinCNY` 则 `Skipped=true`。  
- **禁止**日更任务写 `reward_amount`。  
- 标记已发放时写入 `paid_amount_cny` + `paid_rate`（对打款事实封闭事后篡改）。

汇率：`base_cny` 在日更时用当时 `QuotaPerUnit`/`USDExchangeRate` 写入并快照到行上，避免列表每次跟汇率抖动；**仅 rate 实时**。若产品后续要求汇率也实时，只改 `RewardCalculator` 前的 `BaseCNY` 派生策略，不改表 UK。

### 4.5 报表聚合

```go
type InviterMonthRow struct {
    InviterID     int
    InviterName   string
    InviteeCount  int
    BaseCNY       float64 // SUM(invitee.base_cny)
    // Reward 字段由 Calculator 填充，不入库
}
```

`SELECT inviter_id, SUM(base_cny), COUNT(*) FROM fission_user_month_stats WHERE period_month=? AND eligible_quota>0 GROUP BY inviter_id`  
再 LEFT JOIN `fission_payout_records` 取打款状态。

---

## 5. 日更任务详细设计

### 5.1 调度

- 注册 `ScheduledSystemTaskHandler`，`Type()` 如 `fission_daily_refresh`。  
- `Enabled()`：读 `FissionReportEnabled` + 合规确认 + `common.IsMasterNode`（框架已主节点跑）。  
- 触发时刻：**每天 00:05 `Asia/Shanghai`**。  
  - 现有 `Interval()` 是固定间隔，不是「每日定点」。实现二选一：  
    1. **推荐**：Handler 内计算 `nextRunAt`（或 payload 记录上次日历日），`Interval()` 返回较短轮询（如 1m），`Enabled` 且「今天尚未成功跑过」才 `CreateSystemTask`；或  
    2. 独立 `time.Ticker` + 租约表（弱于 SystemTask，不推荐）。  
- 与 `channelTestHandler` 一样在 `RegisterScheduledSystemTasks` 注册。

### 5.2 时间窗（上海）

设任务在日历日 `D` 的 00:05 运行：

- `as_of_date = D - 1 天`  
- 当前月 `M = YearMonth(as_of_date)`  
- 若 `M < 2026-06`：跳过  
- 覆盖区间：`[MonthStart(M) 00:00:00 +08, as_of_date 23:59:59.999 +08]`  
  （实现用半开区间 `[monthStart, nextDay(as_of_date))` 的 Unix 更干净）

例：2026-07-22 00:05 → 更新 `period_month=2026-07`，数据截止 **2026-07-21**。  
例：2026-08-01 00:05 → `as_of=2026-07-31`，刷新 **2026-07** 月末终态；同时可为 `2026-08` 写空/零行（可选，一般等 8/2 才有 8/1 数据）。

### 5.3 用户集合

```text
候选 = users WHERE inviter_id > 0
       AND (deleted 条件按现网)
可选收窄：在 [monthStart, asOfEnd] 有 wallet consume 或当月已有 stats 行
```

### 5.4 单用户算法

```text
1. 加载/初始化 Ledger（检查点或从头）
2. 合并 Credits + Consume（Consume 过 Filters）事件，排序
3. 回放到 asOfEnd：
   - 累计 monthEligibleQuota（仅落在当月窗内的 paid 扣减）
4. baseCNY = (monthEligibleQuota / QuotaPerUnit) * USDExchangeRate
5. Upsert fission_user_month_stats
   UK (period_month, user_id)
   SET eligible_quota, base_cny, inviter_id, snapshots, as_of_date, updated_at
6. 更新 checkpoint（若启用）
```

**幂等**：同一天重复跑 → 覆盖同 UK 行，结果一致。  
**跨月**：用户在 7 月与 8 月各有一行；7 月行在 8/1 凌晨最后一次刷新后 `as_of_date=07-31`，之后日更不再改 7 月（除非手动重建）。

### 5.5 并发与批次

- 按 `user_id` 分批（如 100/200），限制并发（gopool）。  
- 单用户回放失败：记入 task result 错误列表，不阻断整批（或失败计数超阈值则 task failed）。  
- SystemTask ProgressReporter 汇报处理进度（对齐 channel test）。

### 5.6 手动补跑 / 重算

管理接口：`POST /api/fission/refresh`

```json
{
  "period_month": "2026-07",
  "as_of_date": "2026-07-21",
  "user_id": null
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `period_month` | 是 | 与页面当前选中月份一致；`< 2026-06` 拒绝 |
| `as_of_date` | 否 | 默认 = 上海时区「昨天」；不可晚于昨天；不可超出该月日历范围 |
| `user_id` | 否 | 指定则只重算该被邀请人；否则重算该月全部候选邀请关系用户 |

权限 Admin；逻辑复用同一 `DailyRefreshService`（OCP：HTTP / 定时任务只是触发器）。  

行为：

- 异步：创建 `SystemTask`（type=`fission_daily_refresh`，payload 带 manual 标记），立即返回 `task_id`；页面轮询任务状态或短轮询报表 `as_of_date`。  
- 与定时日更互斥：同类型有进行中任务时返回 409 / 明确提示「重算进行中」。  
- **不改变**页面上的 rate；重算只刷新 `fission_user_month_stats` 基数，应发仍按当前输入 rate 实时算。  
- 已 `paid` 的打款记录不删除；重算后基数变化时，UI 提示「基数已更新，已打款金额仍以冻结值为准」。

---

## 6. 管理端 API 与实时 rate

### 6.1 路由

`router` 中 `api.Group` + `middleware.AdminAuth()`：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/fission/report` | 裂变报表主列表 |
| GET | `/api/fission/report/items` | 某邀请人下被邀请人明细 |
| GET | `/api/fission/report/export` | 导出 |
| POST | `/api/fission/payout/mark_paid` | 标记已发放 |
| POST | `/api/fission/payout/hold` | 挂起/取消 |
| POST | `/api/fission/refresh` | 手动触发重算（见 §5.6） |
| GET | `/api/fission/refresh/:task_id` | 可选：查询重算任务进度 |
| GET | `/api/fission/meta` | 默认 rate、最新 as_of、开关、是否有进行中重算 |

### 6.2 `GET /api/fission/report` 查询参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `period_month` | 是 | `YYYY-MM`，≥ 2026-06 |
| `rate` | 是 | 返佣比例；支持 `0.03` 或 `3`（百分比，需约定一种，推荐统一 **小数 0~1**，前端百分比换算） |
| `status` | 否 | 按打款状态滤；`skipped` 为**计算后**虚拟状态 |
| `inviter_id` / keyword | 否 | |
| `min_reward` / `max_reward` | 否 | 按**实时应发**过滤（内存/子查询后滤） |
| page / size | 是 | |

**响应行（示意）**

```json
{
  "inviter_id": 12,
  "username": "alice",
  "invitee_count": 5,
  "base_cny": 1000.00,
  "rate": 0.03,
  "reward_cny": 30.00,
  "skipped": false,
  "payout_status": "unpaid",
  "as_of_date": "2026-07-21",
  "paid_amount_cny": null
}
```

`reward_cny` / `skipped`：**每次请求用入参 rate 现算**，不读库中的应发字段。

切换 rate 时前端可 debounce 重新请求或纯前端用返回的 `base_cny` 重算（推荐前端本地重算减少抖动；导出仍以服务端按 rate 计算为准保证一致）。

**推荐一致策略**：接口始终返回 `base_cny`；`reward_cny` 服务端按 rate 算一遍；前端输入 rate 变化时可先本地 `base_cny * rate` 预览，导出/打款以服务端为准。

### 6.3 门槛与 skipped

- `reward_raw = base_cny * rate`  
- `reward_raw < 10` → `skipped=true`，`reward_cny=0`（展示用），导出打款清单默认排除  
- **不写** payout 表（除非运营手动标记）；与「作废不滚月」一致：仅展示态

### 6.4 标记已发放

```json
{
  "period_month": "2026-07",
  "inviter_ids": [12, 15],
  "rate": 0.03,
  "voucher": "银行回单号",
  "remark": ""
}
```

服务端：

1. 聚合当前 `base_cny`（及 as_of）  
2. 用请求 `rate` 计算 `payCNY`；若 skipped → 拒绝或跳过该行  
3. Upsert `fission_payout_records`：`status=paid`，冻结 `paid_rate`/`paid_amount_cny`/`base_cny_at_pay`  
4. 审计日志  

已 `paid` 行：列表仍显示冻结金额；**预览列**可同时显示「若用当前输入 rate 的试算」但打款金额以冻结值为准（UI 区分「试算应发」与「已打款」）。

### 6.5 导出

- Query 同列表（必带 `period_month` + `rate`）  
- 列：邀请人 ID/名、基数 CNY、rate、应发 CNY、是否低于门槛、打款状态、as_of_date  
- 实现 `Exporter` 接口，首期 CSV

---

## 7. 前端设计（default）

### 7.1 信息架构

- 侧栏 Admin → **报表** → **裂变报表**（`/reports/fission`）  
- `beforeLoad`：`role >= ADMIN`，否则 `/403`  
- i18n：`Reports` / `Fission Report`

### 7.2 页面区块

1. **筛选栏**：月份选择、rate 输入（默认 3%）、状态、搜索、「查询」  
2. **数据新鲜度**：展示该月数据「已更新至 yyyy-mm-dd」；旁挂操作按钮  
3. **手动重算按钮**（必做，P0）  
4. **表格**：邀请人、基数、**实时应发**、跳过标记、打款状态、操作  
5. **下钻抽屉**：被邀请人 `eligible_quota` / `base_cny`  
6. **导出 / 批量标记已发放**（提交当前 rate）

rate 变更：本地用 `base_cny` 重算列，或重新 fetch；**不**触发日更/重算。

### 7.3 手动重算按钮（UX）

| 项 | 约定 |
|----|------|
| 文案 | 中文 **手动重算**；英文 `Recalculate` |
| 位置 | 筛选栏右侧或「数据新鲜度」旁，主操作级按钮（与导出区分） |
| 作用范围 | 默认对**当前选中月份**全量重算；`as_of_date` 默认昨天（可在确认框展示，高级可选改日期） |
| 交互 | 点击 → 二次确认（说明将覆盖该月基数、可能耗时）→ 调用 `POST /api/fission/refresh` → loading/禁用按钮 → 成功后 toast + 自动刷新列表与 as_of |
| 进行中 | 按钮 disabled，文案改为「重算中…」；`meta` 或 task 接口显示进度（可选） |
| 权限 | 仅管理员；与页面同权 |
| 与 rate | 重算**只更新消费基数**；打款试算仍跟输入框 rate |

确认文案示例：`将按截止昨天的数据重算 {YYYY-MM} 的裂变消费基数，可能需要几分钟。已打款记录不会被修改。是否继续？`

### 7.4 Feature 目录

```text
web/default/src/features/reports/fission/
  api.ts, types.ts, constants.ts, index.tsx
  components/..., hooks/...
routes/_authenticated/reports/index.tsx      # redirect
routes/_authenticated/reports/fission.tsx
```

---

## 8. 数据流时序

### 8.1 日更

```text
Scheduler (00:05 CST)
  → Create SystemTask fission_daily_refresh
  → Claim on master
  → For user in invitees:
       Replay → Upsert stats(period, user_id)
  → FinishTask(succeeded, summary)
```

### 8.2 看报表

```text
Admin 输入 month + rate
  → GET report
  → SUM base_cny by inviter
  → RewardCalculator(rate)
  → JOIN payout_records
  → 返回试算应发 + 打款态
```

### 8.3 打款

```text
Admin 确认 rate 与清单
  → 线下打款
  → mark_paid(rate)
  → 冻结金额与 rate
```

---

## 9. 库表 DDL 要点（三库兼容）

- 避免 `ALTER COLUMN`；SQLite 用 `ADD COLUMN` 迁移模式（见 `model/main.go`）。  
- 金额：可用 `decimal` 字符串或整型「分」；推荐 **CNY 存分（int64）** 避免浮点，API 再格式化为元。  
- 布尔默认值勿用易触发反复 migrate 的 `default:true` 业务默认。  
- AutoMigrate 注册新 model。

唯一约束：

```text
fission_user_month_stats:  (period_month, user_id)
fission_payout_records:    (period_month, inviter_id)
```

Upsert 对齐 `UpsertPerfMetric`：`clause.OnConflict{ Columns: ..., DoUpdates: ... }`。

---

## 10. 与注册邀请奖励的边界

| | 注册邀请 | 裂变报表 |
|--|----------|----------|
| 触发 | 注册成功 | 日更 + 查询 |
| 账户 | `aff_quota` → 可划转 `quota` | 仅现金应付账本 |
| 配置 | `QuotaForInviter` 等 | rate 页面输入 |
| 代码 | 现有 `inviteUser` 不动 | 新包 `service/fission` |

---

## 11. 风险与对策

| 风险 | 对策 |
|------|------|
| 全量回放性能 | 检查点增量；只扫有邀请人用户；分批；必要时按月归档 |
| `aff_transfer` 无日志 | 补系统日志或划转表；Classifier 独立扩展 |
| rate 实时导致「今天看与昨天导出不一致」 | 导出文件带 rate 与 as_of；打款冻结 |
| 月末最后一天数据 | D+1 日 00:05 才纳入 D；财务应等次日刷新后再打上月款 |
| 主从 | 仅 master 跑 SystemTask，与现网一致 |
| 开闭被破坏 | Code review：禁止在 Replayer 内新增 `switch source`；必须走 Register |

---

## 12. 测试设计

| 用例 | 期望 |
|------|------|
| 纯赠送消耗 | `eligible_quota=0`，任意 rate 应发 0 |
| 赠送+充值后消耗 | 仅 paid 部分进基数 |
| 订阅消耗 | 不进台账、不计 eligible |
| 日更两遍同 as_of | 行数据不变（幂等） |
| UK 冲突 | 第二次覆盖为新值 |
| `base=100, rate=0.03` | 应发 3；`rate=0.2` 应发 20（实时） |
| `reward < 10` | skipped |
| `period < 2026-06` | 日更跳过 / API 400 |
| mark_paid | 冻结金额；改 rate 后试算变、已付列不变 |
| 手动重算 | 点击后该月 `as_of`/基数更新；进行中不可重复提交；已 paid 行保留 |
| 注册邀请回归 | AffQuota 用例通过 |

单测：`LedgerReplayer`、`RewardCalculator`、Classifier 用 testify；尽量不依赖真实三库，模型层可用 sqlite。

---

## 13. 实施分期

| 阶段 | 交付 |
|------|------|
| **P0** | 表结构 + Classifier 注册 + 全量回放日更 + Upsert UK + 裂变报表（rate 实时）+ **页面「手动重算」按钮** + 导出 + mark_paid + 侧栏入口 |
| **P1** | Ledger checkpoint 增量、重算进度条、held、审计完善 |
| **P2** | 扣费链路实时 paid/gift 打标（新 Filter/数据源，不改 UK）；更多 CreditClassifier |

---

## 14. 文件清单（建议）

```text
model/fission_user_month_stat.go
model/fission_payout.go
service/fission/registry.go
service/fission/classifier_*.go
service/fission/filter_*.go
service/fission/replayer.go
service/fission/reward.go
service/fission/daily_refresh.go
service/fission/report.go
controller/fission_report.go
controller/system_task_handlers.go          # 注册日更 handler
router/api-router.go
web/default/src/features/reports/fission/**
web/default/src/routes/_authenticated/reports/**
web/default/src/hooks/use-sidebar-data.ts
docs/prd-invite-fission-cashback.md         # 可另提 PR 同步「日更 + rate 实时」修订
```

---

## 15. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-07-22 | 初版详细设计：OCP 插件化台账；日更 UK=`(period_month,user_id)`；rate 实时计奖；对接 SystemTask / Admin 裂变报表 |
| 2026-07-22 | 裂变报表页增加「手动重算」按钮（P0）；复用 refresh API + SystemTask |
