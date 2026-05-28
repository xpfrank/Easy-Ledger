# Easy-Ledger 首页资产驾驶舱 — 代码审计报告

> 审计日期：2026-05-14
> 审计范围：基于改造报告的逐项核查与代码现状偏差分析
> 原则：报告仅作需求参考，具体优化以代码审计结果为准

---

## 一、项目目录结构与模块依赖关系

### 1.1 目录结构

```
src/
├── App.tsx                          # 主应用（路由、主题、全局状态）
├── pages/
│   ├── HomePage.tsx                 # 首页（635行，核心改造区）
│   ├── AccountsPage.tsx             # 账户管理（773行）
│   ├── AccountEditPage.tsx          # 账户编辑
│   ├── AccountDetailPage.tsx        # 账户详情
│   ├── AccountFlowPage.tsx          # 账户流水
│   ├── RecordPage.tsx               # 记账页（1349行，最大组件）
│   ├── RecordLogsPage.tsx           # 记账日志
│   ├── TrendPage.tsx                # 趋势页（1180行，Recharts图表）
│   ├── SettingsPage.tsx             # 设置
│   └── BalanceSankeyPage.tsx        # 桑基图（568行，ECharts）
├── components/
│   ├── home/
│   │   ├── BadgeComponents.tsx      # 目标/健康徽章（54行）
│   │   ├── GoalDetailModal.tsx      # 目标详情弹窗（112行）
│   │   ├── GoalEditModal.tsx         # 目标编辑弹窗（53行）
│   │   ├── HealthDetailModal.tsx     # 健康度详情弹窗（144行）
│   │   ├── HealthScoreCard.tsx       # 健康度评分卡片（92行）
│   │   └── YearlyGoalCard.tsx        # 年度目标卡片（118行）
│   ├── attribution/
│   │   ├── MonthlyAttributionDetail.tsx  # 月度归因（312行）
│   │   └── YearlyAttributionDetail.tsx   # 年度归因
│   ├── ui/                          # 共享UI组件（40+组件）
│   └── Icon.tsx                     # 图标组件
├── lib/
│   ├── storage.ts                   # 数据持久化（1492行，核心）
│   ├── calculator.ts                # 资产计算（585行）
│   ├── health-calculator.ts          # 健康评分（327行）
│   ├── utils.ts                     # 工具函数
│   └── platform.ts                  # 平台检测
├── types/index.ts                   # 类型定义（547行）
└── hooks/
    ├── use-mobile.ts
    └── useTheme.ts
```

### 1.2 模块依赖关系

```
App.tsx
 └── HomePage.tsx
      ├── @lib/storage.ts           (getAccountsForMonth, getYearlyGoal, calculateGoalProgress, etc.)
      ├── @lib/calculator.ts        (calculateNetWorth, calculateTotalAssets, ACCOUNT_TYPES)
      ├── @lib/health-calculator.ts (calculateHealthScore)
      ├── components/home/YearlyGoalCard.tsx
      ├── components/home/HealthScoreCard.tsx
      ├── components/home/BadgeComponents.tsx
      ├── components/home/GoalDetailModal.tsx
      ├── components/home/GoalEditModal.tsx
      └── components/home/HealthDetailModal.tsx

YearlyGoalCard.tsx
 └── @lib/health-calculator.ts (calculateGoalProgress)
 └── @lib/storage (getBaseCurrency)

GoalDetailModal.tsx
 └── @lib/storage (formatAmountNoSymbol)

HealthScoreCard.tsx ← types/index.ts (HealthScore)
HealthDetailModal.tsx ← types/index.ts (HealthScore)
BadgeComponents.tsx ← @lib/health-calculator (calculateGoalProgress)
```

### 1.3 依赖健康度评估

| 维度 | 评级 | 说明 |
|------|------|------|
| 模块解耦 | ⚠️ 中 | HomePage 承担了过多职责（数据获取 + 卡片编排 + SVG 环形图） |
| 循环依赖 | ✅ 无 | 模块间单向依赖清晰 |
| 类型安全 | ⚠️ 中 | 大部分接口有类型，但 HomePage 内有 `AccountGroup` 本地接口，与 types/index.ts 的 `AccountGroup` 重复 |
| 工具函数复用 | ⚠️ 中 | `formatHiddenAmount` 在 HomePage 和 AccountsPage 中各自定义，存在重复 |

---

## 二、各功能模块实现完整度与代码质量

### 2.1 核心页面

| 页面 | 行数 | 完整度 | 代码质量 | 问题 |
|------|------|--------|----------|------|
| HomePage | 635 | ⚠️ 中 | ⚠️ 中 | 承担6个职责：数据加载、3种图表渲染、卡片布局、弹窗状态管理 |
| RecordPage | 1349+ | ⚠️ 中 | ⚠️ 中 | 过于庞大，逻辑耦合严重（日历/记账/归因/预览全部在一个文件） |
| AccountsPage | 773 | ✅ 高 | ✅ 高 | 功能完整，拖拽排序体验好 |
| TrendPage | 1180 | ✅ 高 | ✅ 高 | Recharts 图表实现完善，季度聚合功能完整 |
| BalanceSankeyPage | 568 | ✅ 高 | ✅ 高 | ECharts 桑基图支持触摸手势，体验良好 |

### 2.2 首页卡片组件

| 组件 | 行数 | 完整度 | 偏差 |
|------|------|--------|------|
| **净资产卡片** | 内嵌于HomePage | ✅ 完整 | 渐变背景、金额、较上月、账户数齐全 |
| **年度目标卡片** (YearlyGoalCard) | 118行 | ⚠️ 基本完整 | 有进度条和预测文字，但缺少底部三列速览 |
| **健康度卡片** (HealthScoreCard) | 92行 | ⚠️ 基本完整 | 三格子评分齐全，但缺少"距A级的差距"提示 |
| **资产分布卡片** | 内嵌于HomePage | ⚠️ 不完整 | 使用原始类型（7+分类），未聚合为4类 |
| **借出借入卡片** | 内嵌于HomePage | ✅ 完整 | 正常显示 |
| **归因Streak卡片** | ❌ 不存在 | ❌ 缺失 | 需新建 AttributionStreakCard.tsx |

### 2.3 弹窗组件

| 组件 | 行数 | 完整度 | 偏差 |
|------|------|--------|------|
| **GoalDetailModal** | 112行 | ⚠️ 基本 | 纯文本表格，无进度轨道/StatsGrid/趋势图 |
| **GoalEditModal** | 53行 | ✅ 完整 | 简单可用 |
| **HealthDetailModal** | 144行 | ⚠️ 基本 | 缺"升级路径"区域和CTA按钮 |

### 2.4 数据层

| 模块 | 行数 | 完整度 | 问题 |
|------|------|--------|------|
| **storage.ts** | 1492行 | ✅ 功能完整 | 缺少 lifeStage、allocCategory、健康历史相关接口 |
| **calculator.ts** | 585行 | ⚠️ 有重复代码 | 底部有重复的 generateId() 和 saveData()（应移除） |
| **health-calculator.ts** | 327行 | ✅ 完整 | 配置/波动/归因三大评分体系完整 |

### 2.5 类型系统

| 文件 | 行数 | 完整度 | 问题 |
|------|------|--------|------|
| **types/index.ts** | 547行 | ⚠️ 需扩展 | 缺少 lifeStage 字段、allocCategory 枚举、HealthScore 历史记录类型 |

---

## 三、改造报告偏差分析

### 3.1 首页信息层级（改造点A）

| 报告要求 | 当前状态 | 偏差程度 |
|----------|----------|----------|
| 顺序：净资产 → 驾驶舱 → 年度目标 → 配置结构 → Streak → 借出借入 | 净资产 → 借出借入 → 年度目标 → 健康度 → 资产分布 | 🔴 **严重** |
| 资产驾驶舱卡片（核心） | ❌ 不存在 | 🔴 **缺失** |
| 资产配置结构卡片（4类聚合） | ❌ 不存在（使用原始7+分类） | 🔴 **缺失** |
| 归因 Streak 卡片 | ❌ 不存在 | 🔴 **缺失** |
| 借出借入下沉 | ⬜ 当前在第二位，需下沉 | 🟡 **调整** |

### 3.2 年度目标弹窗（改造点D）

| 报告要求 | 当前状态 | 偏差程度 |
|----------|----------|----------|
| Hero 进度区（百分比大字 + 状态Chip） | ✅ 有百分比（54px），❌ 无状态Chip | 🟡 部分 |
| 可视化进度轨道（带滑块标记） | ❌ 不存在 | 🔴 缺失 |
| Stats Grid 2+1布局 | ❌ 仍为 flex 列表 | 🔴 缺失 |
| Trio 三列速览 | ❌ 不存在 | 🔴 缺失 |
| 月度走势图（Canvas） | ❌ 不存在 | 🔴 缺失 |
| 洞察卡片 | ❌ 不存在 | 🔴 缺失 |
| 提前达成行动建议 | ❌ 不存在 | 🔴 缺失 |

### 3.3 健康度系统（改造点C/H）

| 报告要求 | 当前状态 | 偏差程度 |
|----------|----------|----------|
| HealthScoreCard 增加"距A级的差距"提示 | ❌ 不存在 | 🔴 缺失 |
| HealthDetailModal 增加"升级路径"区域 | ❌ 不存在 | 🔴 缺失 |
| 升级路径 CTA（引导分类） | ❌ 不存在 | 🔴 缺失 |

### 3.4 资产配置聚合（改造点E）

| 报告要求 | 当前状态 | 偏差程度 |
|----------|----------|----------|
| 4类聚合（现金/应急、稳健储蓄、投资增值、保险保障） | ❌ 使用7个原始类型 | 🔴 缺失 |
| 饼图/Doughnut | ✅ 有环形图 | ✅ 已有 |
| 4类进度条 + 理想区间标记线 | ❌ 只有单一进度条 | 🔴 缺失 |
| "去完善"引导按钮 | ❌ 不存在 | 🔴 缺失 |

### 3.5 新增组件清单

| 组件 | 报告优先级 | 当前状态 |
|------|-----------|----------|
| `AssetCockpitCard.tsx` | **P0** | ❌ 不存在 |
| `AssetAllocCard.tsx` | **P0** | ❌ 不存在 |
| `AttributionStreakCard.tsx` | P1 | ❌ 不存在 |
| `LifeStageSheet.tsx` | P1 | ❌ 不存在 |
| `QuickClassifySheet.tsx` | P1 | ❌ 不存在 |

### 3.6 数据层缺口

| 需求 | 当前状态 |
|------|----------|
| `AppSettings.lifeStage` | ❌ 不存在 |
| `getLifeStage()` / `saveLifeStage()` | ❌ 不存在 |
| `Account.allocCategory` | ❌ 不存在 |
| 健康评分历史存储（`HEALTH_HISTORY_KEY`） | ❌ 不存在 |
| `saveHealthHistory()` / `getHealthHistory()` | ❌ 不存在 |

### 3.7 代码质量问题

| 问题 | 位置 | 风险 |
|------|------|------|
| 重复代码：`formatHiddenAmount` | HomePage.tsx:52、AccountsPage.tsx:35 | 低 — 逻辑一致但应提取为共享工具 |
| 重复代码：`generateId()` + `saveData()` | calculator.ts:575-585 | ⚠️ 中 — 与 storage.ts 中同名函数重复，版本号不一致（'1.1' vs '2.0'） |
| HomePage 职责过重 | HomePage.tsx:635行 | ⚠️ 中 — 数据获取 + 4种图表 + 6个弹窗状态 + 聚合计算 |
| RecordPage 过大 | RecordPage.tsx:1349+行 | ⚠️ 中 — 建议拆分 YearlyDashboard、MonthPicker、AttributionPreview 等子组件 |
| `any` 类型滥用 | TrendPage.tsx 多处 | ⚠️ 中 — 使用 `as any` 绕过类型检查 |
| 非空断言滥用 | 多处 `!` 操作符 | ⚠️ 低 — 部分场景可能存在运行时 null |

---

## 四、隐藏金额支持度

报告要求 #6：所有金额支持隐藏/显示切换。

| 组件 | 支持情况 |
|------|----------|
| HomePage 净资产卡片 | ✅ 完整 |
| YearlyGoalCard | ✅ 完整 |
| GoalDetailModal | ✅ 完整 |
| HealthScoreCard | ✅ 完整 |
| HealthDetailModal | ✅ 完整 |
| 资产分布环形图 | ⚠️ 部分（`formatAmountSmart` 支持，但环形图无隐藏） |
| TrendPage | ✅ 完整 |
| BalanceSankeyPage | ✅ 完整 |
| RecordPage | ✅ 完整 |
| AccountsPage | ✅ 完整 |
| MonthlyAttributionDetail | ✅ 完整 |

---

## 五、主题切换支持度

报告要求 #7：所有颜色跟随主题切换。

| 组件 | 支持情况 |
|------|----------|
| 主题色 | ✅ 使用 `themeConfig.primary` |
| 渐变背景 | ✅ 使用 `themeConfig.gradientFrom/gradientTo` |
| 新增组件注意 | ⚠️ 需确保新增组件不硬编码颜色，使用 themeConfig |
| 环形图颜色 | ❌ 硬编码 `LABEL_COLORS`，不随主题变化 |
| 桑基图颜色 | ⚠️ 部分硬编码（TYPE_CONFIG 中 color 为固定值） |

---

## 六、开发优先级建议（基于报告 Phase 分期 + 审计结果）

### Phase 1（本周）— 高价值改动

| 序号 | 任务 | 改动文件 | 说明 |
|------|------|----------|------|
| 1 | **GoalDetailModal 重构** | GoalDetailModal.tsx | 表格 → Hero进度 + 进度轨道 + StatsGrid + Trio + 趋势Canvas + 洞察卡片 |
| 2 | **YearlyGoalCard 精简** | YearlyGoalCard.tsx | 删除长预测文字，增加底部三列速览 |
| 3 | **HealthScoreCard 增加差距提示** | HealthScoreCard.tsx | 新增"距A级还差X分" |
| 4 | **修复 calculator.ts 重复代码** | calculator.ts | 移除底部重复的 generateId/saveData |
| 5 | **类型补全** | types/index.ts | 添加 lifeStage、allocCategory 字段 |

### Phase 2（下周）— 核心新组件

| 序号 | 任务 | 新建/改动文件 | 说明 |
|------|------|-------------|------|
| 6 | **AssetCockpitCard 新建** | 新建 `AssetCockpitCard.tsx` | 整合健康分 + 阶段 + 行动CTA |
| 7 | **AssetAllocCard 新建** | 新建 `AssetAllocCard.tsx` | 4类聚合 + 饼图 + 进度条 + 理想区间 |
| 8 | **AttributionStreakCard 新建** | 新建 `AttributionStreakCard.tsx` | 连续记录激励 |
| 9 | **HomePage 布局重构** | HomePage.tsx | 调整卡片顺序，引入新组件 |
| 10 | **存储层扩展** | storage.ts | 添加 lifeStage CRUD、健康历史存储 |

### Phase 3（下下周）— 交互闭环

| 序号 | 任务 | 新建/改动文件 | 说明 |
|------|------|-------------|------|
| 11 | **LifeStageSheet 新建** | 新建 `LifeStageSheet.tsx` | Bottom Sheet 选择人生阶段 |
| 12 | **QuickClassifySheet 新建** | 新建 `QuickClassifySheet.tsx` | 卡片流式分类 |
| 13 | **HealthDetailModal 升级路径** | HealthDetailModal.tsx | 新增底部升级路径 + CTA按钮 |
| 14 | **资产分布环形图主题适配** | HomePage.tsx | LABEL_COLORS 改为主题感知 |

---

## 七、风险与注意事项（补充审计发现）

1. **calculator.ts 重复 saveData**：底部第 580 行的 `saveData()` 使用 `'simple-ledger-data'` 硬编码 key 且版本号为 `'1.1'`，与 storage.ts 中版本 `'2.0'` 不一致。**必须移除**，否则会导致数据覆盖回旧版本。

2. **AccountGroup 类型冲突**：HomePage.tsx 第 43-49 行定义了本地 `AccountGroup` 接口，与 types/index.ts 第 171-176 行的 `AccountGroup` 类型重复但结构不同（本地多了 `isExpanded`）。建议统一到 types 层或使用组合。

3. **TrendPage 直接读 localStorage**：第 319 行 `JSON.parse(localStorage.getItem(...))` 绕过了 storage.ts 的封装。存在数据格式变更风险，建议改用 `loadData()` API。

4. **多币种聚合**：报告#64提到聚合时需先调用 `convertToBaseCurrency`。当前 `AssetAllocCard` 尚未实现，需确保新建组件正确处理。

5. **性能注意**：HomePage 的 `loadData()` 每次渲染会触发多次 storage 读写（getAccountsForMonth × N），建议使用 useMemo 缓存。

---

## 八、验收标准对标（基于报告 § 八）

| 验收项 | 当前状态 |
|--------|----------|
| 首页卡片顺序符合要求 | ❌ 不符合 |
| 年度目标弹窗3秒内可读完 | ❌ 不符合（仍为表格） |
| 资产配置展示4类聚合 | ❌ 不存在 |
| 人生阶段可在首页切换 | ❌ 不存在 |
| 账户分类有快速流程 | ❌ 不存在 |
| 所有金额支持隐藏/显示 | ✅ 基本满足（环形图需补） |
| 所有颜色跟随主题切换 | ⚠️ 部分（环形图硬编码） |