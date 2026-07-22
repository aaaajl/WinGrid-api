# PRD：裂变报表（邀请消费现金返佣）

> 状态：待开发  
> 日期：2026-07-21（2026-07-22 修订数据生产与计奖方式）  
> 范围：按一级邀请关系，对被邀请人「付费额度承担」的 API 消耗折现后按比例计算现金奖励；管理员在控台「报表 → 裂变报表」中查看发放清单并人工打款回写  
> 详细设计：[design-invite-fission-cashback.md](./design-invite-fission-cashback.md)  
>  
> **2026-07-22 修订**：① 基数由**每日凌晨**任务维护，唯一键 `(period_month, user_id)`（被邀请人），覆盖至**前一天**的当月数据；② 报表打款金额按页面输入 **rate 实时计算**，不在日更中落库应发金额（打款回写时再冻结）。

---

## 1. Executive Summary

### Problem Statement

平台已有注册邀请关系与一次性邀请额度奖励，但缺少「按被邀请人真实付费消耗持续返现」的能力，也没有按月列出「应发给谁、发多少」的管理报表，无法支撑线下现金打款与对账。

### Proposed Solution

新增 **裂变现金返佣** 能力：以一级 `inviter_id` 为准，将被邀请人自然月内由**付费额度承担**的 consume 消耗折合人民币，按页面可调比例（默认 3%）计算应发金额；在管理员控台新增 **报表** 模块下的 **裂变报表**，支持选月份、调比例、生成/确认账期、导出清单、标记已发放。与现有注册邀请额度（`AffQuota`）并行、分账。

### Success Criteria

1. 管理员可在 **裂变报表** 中选择账期月份与返佣比例，生成该月发放明细；导出文件可直接用于人工打款。
2. 返佣基数仅为「付费额度承担」的消耗；纯赠送/活动额度消耗不产生应发。
3. 单邀请人单月应发 &lt; ¥10 记为跳过（作废不发、不滚入下月）；≥ ¥10 进入待发放。
4. 仅统计账期 ≥ `2026-06`；更早月份不可生成应发账期。
5. 注册邀请额度奖励（`QuotaForInviter` / `QuotaForInvitee` / `aff_transfer`）行为零回归；裂变应发**不**写入 `aff_quota`。

---

## 2. User Experience & Functionality

### User Personas

| 角色 | 诉求 |
|------|------|
| 系统管理员 / 财务操作人 | 按月算出应发清单，导出后线下打款，并在系统回写发放状态 |
| 运营 | 调整某月返佣比例、核对邀请贡献明细 |
| 普通用户 / 邀请人 | **本需求无自助界面**（首期不展示应发现金） |

### User Stories

#### Story 1 — 管理端入口：报表模块 / 裂变报表

> As a 管理员, I want to 在管理员控台打开「裂变报表」, so that 我能集中处理邀请现金返佣的生成、查询与发放回写。

**Acceptance Criteria**

- 在管理员侧栏 **Admin** 区域新增 **报表** 模块；其下（或作为该模块默认页）提供 **裂变报表**。
- 建议路由：
  - `/reports` → 重定向至 `/reports/fission`
  - `/reports/fission`：裂变报表页
- 仅管理员（与 Users / Channels 同级）可见；普通用户侧栏不出现。
- 页面标题：中文 **裂变报表**；英文 i18n 键建议 `Fission Report`；模块名 **报表** / `Reports`。
- 页内可附简短说明：按被邀请人付费消耗折现发放邀请现金奖励。
- default 主题为交付范围；classic 主题是否同步入口由实现阶段决定，文档默认 **default 必做**。

#### Story 2 — 按月份与比例生成账期

> As a 管理员, I want to 在页面上输入账期月份和返佣比例并生成报表, so that 不同月份可用不同比例且发放依据可审计。

**Acceptance Criteria**

- 生成表单必填：
  - **账期月份**：`YYYY-MM`，按 `Asia/Shanghai` 解释该自然月窗口 `[当月1日 00:00:00, 下月1日 00:00:00)`。
  - **返佣比例**：页面以百分比输入（如 `3` 表示 3%），落库为小数 `0.03`；默认预填系统默认值 **3%**；允许当次修改。
- 比例校验：建议 `0 < rate ≤ 100%`（若需更严上限可在实现时配置，默认按此）。
- 生成时只读展示将写入快照的 `QuotaPerUnit`、`USDExchangeRate`。
- 月份 &lt; `2026-06`：拒绝生成并提示。
- 同一账期若已存在且状态为 `draft`：允许用新比例**重算覆盖**；若为 `confirmed` / `paying` / `paid`：禁止覆盖，须先作废（`void`）再新建。
- 系统设置可保留「默认比例」仅作预填；**结算以账期 `rate_snapshot` 为准**。

#### Story 3 — 查看发放明细并下钻

> As a 管理员, I want to 按月查看应发给哪些用户多少钱及计算依据, so that 我能核对后打款。

**Acceptance Criteria**

- 账期列表字段至少包含：账期、状态、使用比例（快照）、总付费消耗折合 CNY、总应发 CNY、待发/已发/跳过人数、生成与确认时间。
- 发放明细（statements）列至少包含：
  - 邀请人 ID、用户名
  - 本期有效被邀请人数（有 eligible 消耗的）
  - 付费消耗折合 CNY（基数）
  - 比例快照
  - 应发 CNY
  - 状态：`pending` / `skipped` / `held` / `paid`
  - 实发金额、打款时间、凭证号/备注
- 支持按账期、状态、邀请人、应发金额区间筛选。
- 支持下钻到每个被邀请人贡献（`eligible_quota`、折合 CNY、贡献奖励）。
- `skipped`（应发 &lt; ¥10）在列表中可见，导出时可过滤。

#### Story 4 — 导出与标记已发放

> As a 管理员, I want to 导出打款清单并在打款后标记已发放, so that 系统状态与线下打款一致。

**Acceptance Criteria**

- 支持按账期导出 CSV/Excel，至少含：用户 ID、用户名、应发金额（CNY）、状态、账期、比例快照。
- 支持单条/批量将 `pending`（及可选 `held` 解除后）标记为 `paid`；可填写打款凭证号与备注。
- 账期在全部应付行处理完毕（`pending`/`held` 清零，`skipped` 可保留）后可置为 `paid`。
- 关键写操作写入审计日志（操作人、时间、账期、影响行数）。

#### Story 4b — 页面手动重算

> As a 管理员, I want to 在裂变报表页点击「手动重算」刷新当月消费基数, so that 不必等次日凌晨日更即可核对最新数据。

**Acceptance Criteria**

- 裂变报表筛选区提供按钮：**手动重算**（i18n：`Recalculate`）。
- 对**当前选中月份**触发服务端重算（截止默认「昨天」）；二次确认后提交。
- 重算只更新消费基数（`fission_user_month_stats`），**不**改页面 rate，应发仍按输入 rate 实时计算。
- 进行中按钮禁用并提示；不可并行重复提交；完成后自动刷新列表与「已更新至」日期。
- 已打款记录不被删除或改写冻结金额。

#### Story 5 — 与注册邀请奖励并行

> As a 运营/管理员, I want to 保留现有注册邀请额度奖励, so that 拉新礼包与持续返现互不影响。

**Acceptance Criteria**

- `QuotaForInviter` / `QuotaForInvitee`、`aff_quota`、`/api/user/aff_transfer` 行为不变。
- 裂变现金应发**不得**自动转入用户 `quota` 或 `aff_quota`。
- 支付合规未确认时：与现有邀请额度策略一致，裂变功能不可启用或不可生成发放账期（实现时与 `payment_setting.compliance_confirmed` 对齐）。

### Non-Goals（首期不做）

- 邀请人自助查看应发/已发现金
- 用户收款信息采集、在线提现、自动打款对接
- 多级邀请、阶梯比例（页面每次输入固定比例即可，非按消费阶梯）
- 订阅资金源消耗计入返佣
- 扣费链路实时 `paid/gift` 打标改造（首期用台账回放；可作为后续优化）
- 将裂变奖励发到平台余额冒充「现金」

---

## 3. 业务规则（已锁定）

| # | 规则 | 定案 |
|---|------|------|
| 1 | 消费口径 | API 消耗额度折现（`logs` type=consume） |
| 2 | 奖励形态 | 真实现金；报表 + 人工打款 + 状态回写 |
| 3 | 默认比例 | 3%；**页面可改**，写入账期快照 |
| 4 | 邀请层级 | 仅一级（`users.inviter_id`） |
| 5 | 时区与账期 | `Asia/Shanghai` 自然月；**月份页面可选** |
| 6 | 发放门槛 | 单邀请人单月应发 &lt; **¥10** → 不发且作废（不滚月） |
| 7 | 赠送/活动消耗 | **不计入**；见 §4 台账规则 |
| 8 | 历史起点 | 账期 ≥ **2026-06** |
| 9 | 报表使用者 | 仅管理员（裂变报表） |
| 10 | 注册邀请奖励 | 保留并行 |
| 11 | 币种 | 人民币；`CNY = (quota / QuotaPerUnit) × USDExchangeRate`，跟随配置并快照 |

### 计算公式

对邀请人 \(A\)、账期 \(P\)、该期快照比例 \(r\)（如 \(0.03\)）：

\[
\begin{align*}
\text{eligible\_quota}(B,P) &= \text{被邀请人 } B \text{ 在 } P \text{ 内由付费额度承担的 consume 额度之和} \\
\text{base\_cny}(A,P) &= \sum_{B:\,inviter(B)=A} \frac{\text{eligible\_quota}(B,P)}{\text{QuotaPerUnit}} \times \text{USDExchangeRate} \\
\text{reward\_raw}(A,P) &= \text{base\_cny}(A,P) \times r \\
\text{应发}(A,P) &=
\begin{cases}
0 \text{（status=skipped）} & \text{若 } \text{reward\_raw} < 10 \\
\text{round\_cents}(\text{reward\_raw}) & \text{否则（status=pending）}
\end{cases}
\end{align*}
\]

- 金额精度：人民币保留 **2 位小数（分）**；全站统一舍入规则（建议四舍五入到分）。
- `QuotaPerUnit`、`USDExchangeRate`、`r` 均以账期快照参与计算与展示。

---

## 4. Technical Specifications

### Architecture Overview

```text
consume / topup / gift 入账日志
        │
        ▼
  按用户时间序台账回放（赠送优先扣减）
        │
        ▼
  账期内 eligible_quota（仅付费承担部分）
        │
        ▼
  按 inviter_id 聚合 → × rate_snapshot → 门槛过滤
        │
        ▼
  invite_cashback_periods / statements / items
        │
        ▼
  管理端「裂变报表」查询 / 导出 / 标记已发放
```

### 4.1 付费 vs 赠送台账（赠送不计入的实现口径）

现网钱包为单一 `quota` 混池，consume 日志不区分资金来源。结算时对每个用户做**虚拟台账回放**（不改动实时扣费链路）：

**付费入账（计入 paid_balance）**

- 在线充值成功对应的额度入账（`topups` 成功等）

**赠送入账（计入 gift_balance）**

- 新用户注册赠送（`QuotaForNewUser`）
- 被邀请注册赠送（`QuotaForInvitee`）
- 邀请奖励划转入余额（`aff_transfer`）
- 兑换码
- 签到奖励
- 管理员加额度（首期默认赠送）

**消耗**

- 钱包侧 `consume`：先扣 `gift_balance`，不足再扣 `paid_balance`；**仅从 paid 扣减的额度计入 `eligible_quota`**。
- **订阅资金源消耗**：首期整笔排除，不计入返佣，也不参与钱包台账扣减。

**期初与历史**

- 台账建议自用户开户/最早相关日志起回放，以保证 2026-06 起余额分类正确。
- 无法追溯的期初余额：**一律视为赠送**（保守、避免误发）。
- 仅对账期 ≥ 2026-06 的 eligible 消耗计发；更早消耗即使回放得出付费部分也不生成应发。

**邀请关系**

- 以被邀请人 `inviter_id` 为准；无邀请人则不进入任何人应发。
- 邀请人禁用：默认仍可生成应发，状态可用 `held` 待人工；被邀请人禁用：其消耗仍计入（首期）。

### 4.2 数据模型（概念）

#### 配置（系统选项，可选）

| 键 | 默认 | 说明 |
|----|------|------|
| `InviteCashbackEnabled` | false/true（实现定） | 总开关 |
| `InviteCashbackRate` | `0.03` | 页面预填默认比例 |
| `InviteCashbackMinPayoutCNY` | `10` | 门槛 |
| `InviteCashbackTimezone` | `Asia/Shanghai` | 账期时区 |
| `InviteCashbackStartPeriod` | `2026-06` | 最早可生成账期 |

#### `invite_cashback_periods`

- `period`（`YYYY-MM`）
- `status`：`draft` | `confirmed` | `paying` | `paid` | `void`
- `timezone`
- `rate_snapshot`
- `quota_per_unit_snapshot`
- `usd_exchange_rate_snapshot`
- 汇总：总基数 CNY、总应发、各状态计数
- `created_at` / `confirmed_at` / `paid_at` / 操作人

#### `invite_cashback_statements`

- 唯一约束：`(period, inviter_id)`
- 字段：邀请人信息、invitee 有效数、`base_cny`、`reward_amount`、`paid_amount`、`status`、`paid_at`、凭证与备注

#### `invite_cashback_statement_items`

- `(period, inviter_id, invitee_id)`
- `eligible_quota`、`consume_amount_cny`、`rate`、`reward_amount`

须兼容 SQLite / MySQL / PostgreSQL（GORM；避免库特有类型与无回退的 DDL）。

### 4.3 账期状态机

```text
draft（可重算） → confirmed（锁定） → paying → paid
                ↘ void
```

| 邀请人行状态 | 含义 |
|--------------|------|
| `pending` | 应发 ≥ ¥10，待打款 |
| `skipped` | 应发 &lt; ¥10，作废 |
| `held` | 人工挂起 |
| `paid` | 已打款 |

可选定时任务：每月 1 日 02:00（上海）自动生成上月 `draft`（使用默认比例）；与页面手动生成并存。已存在非 draft 账期则跳过自动覆盖。

### 4.4 API 轮廓（管理端）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/invite_cashback/periods` | 账期列表 |
| POST | `/api/invite_cashback/periods/generate` | body: `{ period, rate }` 生成/重算 draft |
| POST | `/api/invite_cashback/periods/:period/confirm` | 确认锁定 |
| POST | `/api/invite_cashback/periods/:period/void` | 作废 |
| GET | `/api/invite_cashback/statements` | 明细列表（筛选） |
| GET | `/api/invite_cashback/statements/:id/items` | 下钻 |
| POST | `/api/invite_cashback/statements/mark_paid` | 批量标记已发放 |
| GET | `/api/invite_cashback/export` | 导出 |

权限：管理员；写操作记审计。JSON 序列化走项目 `common.Marshal` / `Unmarshal` 约定。

### 4.5 前端模块（default）

- Feature 建议路径：`web/default/src/features/reports/fission/`（或 `invite-cashback/`）
- 路由：`web/default/src/routes/_authenticated/reports/...`
- 侧栏：`use-sidebar-data` 的 Admin 组增加报表入口
- 文案全部 `t('...')`；中英等 locale 按项目 i18n 规范补齐

### 4.6 Security & Privacy

- 仅管理员可访问接口与页面。
- 导出含用户 ID/用户名与金额，按现有管理数据导出管控处理。
- 不在本需求中存储银行卡/支付宝等收款敏感信息。
- 合规确认门禁与支付/邀请奖励一致。
- 已锁定账期禁止静默用新汇率/新比例重算，防止账实不符。

### 4.7 与现网集成点

| 现网能力 | 用法 |
|----------|------|
| `users.inviter_id` / `aff_code` | 一级邀请关系 |
| `logs`（consume） | 消耗明细 |
| topup / redemption / checkin / system 赠送日志 | 台账入账分类 |
| `QuotaPerUnit`、`USDExchangeRate` | CNY 折算 |
| 注册邀请 `AffQuota` | 并行保留，分账 |

结算**不要**使用 `users.used_quota`（终身累计）。优先精确聚合 `logs`；`quota_data` 仅作辅助，不作唯一结算源。

---

## 5. Risks & Roadmap

### Technical Risks

| 风险 | 缓解 |
|------|------|
| 混池额度导致「赠送不计入」只能近似回放 | 规则写死赠送优先；无法追溯期初当赠送；后续可扣费打标 |
| 大盘全量用户回放性能 | 按有邀请关系的用户批处理；仅聚合有 inviter 的 invitee；必要索引与分批 |
| 汇率事后变更 | 账期快照；confirmed 后不重算 |
| 刷邀请 + 付费自消耗套现 | 首期依赖人工抽查；后续可加风控（非本 MVP） |
| 订阅消耗口径争议 | 首期明确排除；若业务要计入需另开变更 |

### Phased Rollout

| 阶段 | 范围 |
|------|------|
| **P0（MVP）** | 台账回放 + 生成账期（月份/比例可输入）+ 裂变报表列表/下钻/导出/标记已发放 + 与注册邀请并行 + 起始 2026-06 |
| **P1** | 账期确认锁、void、held、操作审计完善、自动月初生成、订阅排除量展示 |
| **P2（可选）** | 扣费实时 paid/gift 标记；管理员加款「付费」标记；收款信息；邀请人自助只读 |

### 验收用例（摘要）

1. 用户仅有赠送额度并消耗完毕 → 其邀请人该月基数为 0。  
2. 先赠送后充值再消耗：仅付费承担部分 × 页面比例计奖。  
3. 应发 9.99 → `skipped`；10.00 → `pending`。  
4. 生成 `2026-05` → 失败。  
5. 生成 `2026-06` 时将比例改为 5% → 该期按 5%；另月用 3% 互不影响。  
6. 导出后标记 paid → 列表状态一致。  
7. 注册邀请额度与划转回归通过。

---

## 6. 文档修订记录

| 日期 | 变更 |
|------|------|
| 2026-07-21 | 初稿：基于业务确认项定稿（口径 A、现金人工打款、默认 3%、一级、上海自然月、¥10 作废、赠送不计、自 2026-06、仅管理员、注册奖励并行、CNY 跟配置） |
| 2026-07-21 | 月份与 rate 改为裂变报表页可输入；写入账期快照 |
| 2026-07-21 | 管理端新增「报表」模块，报表名「裂变报表」 |
| 2026-07-22 | 改为日更事实表 UK=`(月份,用户id)`；应发按输入 rate 实时计算；详见 design 文档 |
| 2026-07-22 | 裂变报表增加「手动重算」按钮（Story 4b） |
