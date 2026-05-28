# Easy-Ledger 首页整改实现报告

> 基于代码文件的对照分析  
> 生成日期：2026-05-18  
> 对照整改报告版本：2026-05-18

---

## 一、现状摘要（代码现状 vs 整改目标）

| 模块 | 当前代码状态 | 整改目标 | 差距 |
|------|------------|---------|------|
| 资产健康概览 | `AssetCockpitCard`：显示分数 + `/100` + ABCD/S 等级标签 + 五段进度条 | 大数字 + 状态文字，**不显示** `/100` 和等级标签 | ⚠️ 需改造 |
| 资产洞察 | 带 `⚠️` / `✓` / `💡` 图标，有背景色区分 warning/success/info | 纯文字描述，去掉图标和背景色区分 | ⚠️ 需改造 |
| 资产结构 | 横向堆叠条已实现，无理想区间 | 基本符合，描述文字逻辑已正确 | ✅ 基本合规 |
| 等级进度条 | 五段 D/C/B/A/S 进度条显式展示 | 完全删除 | ❌ 需删除 |
| 人生阶段 | 右上角下拉按钮（可点击展开选项） | 纯静态小标签，不可下拉 | ⚠️ 需简化 |
| HealthBadge | `HomePage` 引用了 `HealthBadge`，但 `BadgeComponents.tsx` 里**没有定义** | 如保留则需实现；如删除则清理引用 | ❌ 代码缺失 |
| HealthScoreCard | 显示 `/100`、ABCD 等级、配置评分/波动控制/归因完整三格子 | **整个组件应退出首页渲染** | ❌ 需下架 |
| LifeStageSheet | 展示每个阶段的"配置推荐区间"，文案含"此阶段决定配置推荐区间和理想线位置" | 去掉"用于评分/理想区间"的文案，保留阶段选择功能 | ⚠️ 需修改文案 |
| Quick Classification Flow | **完全不存在** | 全新实现 | ❌ 需新增 |

---

## 二、逐文件改造方案

### 2.1 `AssetCockpitCard.tsx` — 核心改造（P0）

这是首页最重要的卡片，需要改造最多。

#### 删除项

| 位置 | 内容 | 说明 |
|------|------|------|
| `GRADE_SCALE` 常量（第 15–21 行） | D/C/B/A/S 五级定义 | 整个常量删除 |
| Hero 区评分展示（第 308–319 行） | `/100` 文字 + `{currentGrade.grade}级 · {currentGrade.label}` 标签 | 删除 `/100`；删除等级标签 |
| 五段分级进度条（第 379–420 行） | `GRADE_SCALE.map(...)` 渲染的多彩进度条 | 整个 `<div className="mb-5">` 块删除 |
| `coreCards` 中的 `score` 和 `/100`（第 444–449 行） | 每个指标卡片内的数字评分 `{card.score}` 和 `<span>/100</span>` | 删除数字，只保留标签文字和描述 |
| 洞察 Feed 的图标和背景色（第 466–491 行） | `⚠️` / `✓` / `💡` + `warning/success/info` 背景 | 统一改为纯文字样式 |
| CTA 底部色块（第 580–600 行） | 渐变色 Banner "当前最优先 + 查看详情按钮" | 改为简洁的文字链接，或删除整个 CTA 块 |
| `showStagePicker` 下拉交互（第 218–219, 344–376 行） | 人生阶段下拉选择器 | 改为纯静态展示标签（详见 2.4） |

#### 修改项

**Hero 区分数展示**（改造后目标样式）：

```tsx
// 修改前
<span className="text-[40px] font-extrabold ..." style={{ color: currentGrade.color }}>
  {healthScore.score}
</span>
<span className="text-sm text-gray-400">/100</span>
<span style={{ backgroundColor: currentGrade.bg, color: currentGrade.color }}>
  {currentGrade.grade}级 · {currentGrade.label}
</span>

// 修改后
<span className="text-[44px] font-extrabold ..." style={{ color: statusColor }}>
  {healthScore.score}
</span>
<span className="text-sm font-bold px-2 py-0.5 rounded-md"
  style={{ backgroundColor: `${statusColor}15`, color: statusColor }}>
  {statusText}   {/* "优秀" / "良好" / "一般" / "需关注" */}
</span>
```

> `statusText` 和 `statusColor` 的逻辑可直接复用 `AssetHealthCard.tsx` 中已有的 `getStatusText()` / `getStatusColor()` 函数（第 8–25 行）。

**资产洞察**（去掉图标和背景色区分）：

```tsx
// 修改前
<div className="flex items-start gap-2.5 p-2.5 rounded-lg border"
  style={{ backgroundColor: insight.type === 'warning' ? '#fefce8' : ... }}>
  <span>{insight.type === 'warning' ? '⚠️' : '✓'}</span>
  <div>
    <div className="text-[12px] font-bold text-amber-700">{insight.title}</div>
    <div className="text-[11px] text-gray-500">{insight.desc}</div>
  </div>
</div>

// 修改后
<div key={i} className="py-2">
  <div className="text-[13px] font-bold text-gray-800">{insight.title}</div>
  <div className="text-[12px] text-gray-500 leading-relaxed mt-0.5">{insight.desc}</div>
</div>
```

**四格指标卡（coreCards）**（只保留标签+描述，删除数字评分）：

```tsx
// 修改后的卡片内容（删除 score 数字和 /100）
<div className="flex items-center gap-1.5 mb-2">
  <Icon size={14} style={{ color: card.color }} />
  <span className="text-[11px] font-semibold text-gray-600">{card.label}</span>
</div>
<div className="text-[12px] font-bold mb-0.5" style={{ color: card.color }}>
  {card.gradeLabel}
</div>
<div className="text-[11px] text-gray-500 leading-relaxed">
  {card.desc}
</div>
```

---

### 2.2 `BadgeComponents.tsx` — 修复缺失 + 简化（P0）

**问题：** `HomePage.tsx` 第 13 行导入了 `HealthBadge`，但文件中只定义了 `GoalBadge`，`HealthBadge` **根本不存在**，当前代码会报编译错误。

**方案A（推荐）：删除 HealthBadge 引用**

直接从 `HomePage.tsx` 删除 `HealthBadge` 的引用和渲染（第 289–293 行）。净资产卡片顶部已有眼睛图标和 GoalBadge，不需要再显示健康分徽章。

```tsx
// HomePage.tsx 删除以下内容
// import { GoalBadge, HealthBadge } from ...  →  import { GoalBadge } from ...
// 删除 <HealthBadge healthScore={healthScore} onClick={...} />
```

**方案B：补充实现 HealthBadge（简化版）**

如果产品希望保留入口徽章，则在 `BadgeComponents.tsx` 中补充实现，但显示状态文字而不是分级：

```tsx
export function HealthBadge({ healthScore, onClick }: { healthScore: HealthScore; onClick?: () => void }) {
  const statusText = healthScore.score >= 85 ? '优秀' : healthScore.score >= 70 ? '良好' : '需关注';
  return (
    <button onClick={onClick}
      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ backgroundColor: 'rgba(255,255,255,0.25)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.35)' }}>
      <Activity size={12} />
      {statusText}
    </button>
  );
}
```

---

### 2.3 `HealthScoreCard.tsx` — 下架（P0）

`HealthScoreCard` 是整改报告中明确删除的组件（ABCD等级、配置评分/波动控制/归因完整三格子、距下一等级进度条）。

**操作：**
- 确认 `HomePage.tsx` 中**没有引用** `HealthScoreCard`（当前代码确认未引用，仅使用 `AssetCockpitCard`）
- 文件可保留但**不在首页渲染**
- 搜索全局是否有其他页面引用，如有，按需处理

---

### 2.4 `AssetCockpitCard.tsx` — 人生阶段标签简化（P2）

当前实现：右上角有一个可点击的下拉按钮（`showStagePicker`），点击后弹出选项列表。

整改要求：仅作为"小标签"展示，不在此处提供交互。

**修改方案：** 删除下拉交互，改为静态标签，点击则触发 `onStageClick`（唤起完整的 `LifeStageSheet`）：

```tsx
// 修改前（第 345–376 行）：可展开的下拉选择器
<button onClick={() => setShowStagePicker(!showStagePicker)}>
  {currentStage.label}
  <ChevronDown size={10} />
</button>
{showStagePicker && <div>...下拉列表...</div>}

// 修改后：纯静态标签，点击唤起 Sheet
<button
  onClick={(e) => { e.stopPropagation(); if (onStageClick) onStageClick(); }}
  className="text-[10px] font-medium px-2 py-1 rounded-md"
  style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', color: '#6b7280' }}
>
  {currentStage.label}
</button>
```

同时删除：`showStagePicker` state、`handleSaveStage` 函数、`ChevronDown` import（如不再使用）。

---

### 2.5 `LifeStageSheet.tsx` — 文案修正（P2）

**需删除的文案（第 171 行）：**
```tsx
// 删除
<div className="text-[11.5px] text-white/55">此阶段决定配置的推荐区间和理想线位置</div>
```

**替换为：**
```tsx
<div className="text-[11.5px] text-white/55">仅作为参考标签，不影响健康评分计算</div>
```

**底部说明文字（第 206 行）同步修改：**
```tsx
// 删除
💡 阶段只影响配置条形图的推荐区间位置，不改变健康评分的计算规则。

// 替换为
💡 人生阶段仅作为参考背景，帮助你更好地理解当前资产结构，不用于评分计算。
```

---

### 2.6 `AssetAllocCard.tsx` — 已基本合规，小调整（P1）

当前代码：
- ✅ 无理想区间对比
- ✅ 只展示现状占比和描述文字
- ✅ 描述文字逻辑符合整改方向

**无需大改**，可做一个小优化：`AGGREGATED_TYPES` 中 `insurance` 类型的 `types` 字段为空数组 `[]`，导致保险资产永远为 0%。需确认账户 type 的枚举值，将 `insure` 或对应类型加入映射。

---

### 2.7 `HealthDetailModal.tsx` — 基本合规，小改（P1）

当前弹窗已实现整改报告要求的结构（当前状态、主要优势、当前风险、建议关注），且**没有 A/S/+20分**等游戏化文案。

**只需确认一处：** 弹窗标题栏是否有等级展示。当前代码仅显示"资产健康分析"，符合要求。

✅ 该文件无需改动。

---

### 2.8 `HomePage.tsx` — 串联逻辑调整（P0/P1）

| 位置 | 操作 |
|------|------|
| 第 13 行 `HealthBadge` import | 删除（或保留并实现，参见 2.2） |
| 第 289–293 行 `<HealthBadge>` 渲染 | 删除 |
| `showLifeStageSheet` 触发逻辑 | 保留，由 `AssetCockpitCard` 的 `onStageClick` 回调唤起 |
| Quick Classification 相关 state | 新增（见第三章） |
| Quick Classification 入口卡片 | 在资产健康驾驶舱卡片之后插入（条件渲染） |

---

## 三、Quick Classification Flow — 全新实现方案（P0）

### 3.1 数据层 — `storage.ts` 新增内容

```typescript
// 1. Account 接口新增字段（需在 types.ts 或 storage.ts 中找到 Account 接口并添加）
interface Account {
  // ...现有字段...
  assetCategory: 'cash' | 'stable' | 'invest' | 'insure' | null; // null = 未分类
}

// 2. 新增：读写用户是否"暂时跳过分类"的标志
const QC_DISMISSED_KEY = 'qc_dismissed';
export function getQCDismissed(): boolean {
  return localStorage.getItem(QC_DISMISSED_KEY) === 'true';
}
export function setQCDismissed(val: boolean): void {
  localStorage.setItem(QC_DISMISSED_KEY, val ? 'true' : 'false');
}

// 3. 新增：保存单个账户的 assetCategory
export function saveAccountAssetCategory(accountId: string, category: Account['assetCategory']): void {
  // 从 localStorage 读取账户列表，找到对应 id，更新 assetCategory，写回
  const accounts = getAllAccounts(); // 使用现有的账户读取函数
  const updated = accounts.map(a => a.id === accountId ? { ...a, assetCategory: category } : a);
  localStorage.setItem('accounts', JSON.stringify(updated));
}
```

> **确认事项（对应整改报告第十节第1、2、4条）：**
> - 当前 `Account` 接口是否有 `assetCategory` 字段？→ 搜索确认为**无**，需新增
> - 默认值应为 `null`（`undefined` 也可，但建议统一为 `null`）
> - 分类数据仅存储在 `localStorage`，无需调用后端接口

---

### 3.2 新增组件 `QuickClassifyFlow.tsx`

新建文件：`src/components/home/QuickClassifyFlow.tsx`

**组件职责：**
1. 接收未分类账户列表
2. 卡片轮播式逐一引导分类
3. 完成后回调通知父组件刷新数据

**Props 接口：**
```typescript
interface QuickClassifyFlowProps {
  unclassifiedAccounts: Account[];
  primaryColor: string;
  onComplete: () => void;   // 全部分类完成
  onDismiss: () => void;    // 用户点击"暂时跳过"
}
```

**核心状态：**
```typescript
const [currentIndex, setCurrentIndex] = useState(0);
const [showDoneOverlay, setShowDoneOverlay] = useState(false);
const total = unclassifiedAccounts.length;
const currentAccount = unclassifiedAccounts[currentIndex];
```

**四分类选项配置：**
```typescript
const CATEGORIES = [
  { key: 'cash',   label: '现金/应急', icon: '💧', desc: '日常流动资金、应急储备' },
  { key: 'stable', label: '稳健储蓄', icon: '🏦', desc: '银行存款、低风险理财' },
  { key: 'invest', label: '投资增值', icon: '📈', desc: '股票、基金、权益类资产' },
  { key: 'insure', label: '保险保障', icon: '🛡️', desc: '保险、年金等保障类' },
] as const;
```

**分类选择逻辑：**
```typescript
const handleSelect = (category: 'cash' | 'stable' | 'invest' | 'insure') => {
  saveAccountAssetCategory(currentAccount.id, category);
  if (currentIndex + 1 >= total) {
    setShowDoneOverlay(true);
  } else {
    setCurrentIndex(prev => prev + 1);
  }
};

const handleSkip = () => {
  if (currentIndex + 1 >= total) {
    onDismiss();
  } else {
    setCurrentIndex(prev => prev + 1);
  }
};
```

**完成弹窗（doneOverlay）文案：**
```tsx
// ✅ 正确文案
<div className="text-lg font-bold">账户分类完成</div>
<div className="text-sm text-gray-500">{total} 个账户已归类，资产结构分析已更新</div>

// ❌ 禁止出现的文案
// "健康评分 78 → 92分"、"+20分"、"升级"
```

---

### 3.3 首页入口卡片（内联在 `HomePage.tsx`）

**条件判断逻辑：**
```typescript
// 在 loadData() 之后计算
const allAccounts = getAccountsForMonth(currentYear, currentMonth).filter(a => !a.isHidden);
const unclassifiedAccounts = allAccounts.filter(a => a.assetCategory == null);
const dismissed = getQCDismissed();
const showQuickClassify = unclassifiedAccounts.length > 0 && !dismissed;
```

**入口提示条（放置位置：`AssetCockpitCard` 之后）：**
```tsx
{showQuickClassify && !showQCFlow && (
  <div
    className="flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-gray-100 cursor-pointer"
    onClick={() => setShowQCFlow(true)}
  >
    <div>
      <div className="text-[13px] font-bold text-gray-800">
        还有 {unclassifiedAccounts.length} 个账户未分类
      </div>
      <div className="text-[11px] text-gray-400 mt-0.5">
        完成分类可解锁完整资产结构分析
      </div>
    </div>
    <span className="text-xs font-bold px-3 py-1.5 rounded-full text-white"
      style={{ backgroundColor: primaryColor }}>
      去分类 ›
    </span>
  </div>
)}
```

**Bottom Sheet 形式的 Flow 渲染：**
```tsx
{showQCFlow && (
  <QuickClassifyFlow
    unclassifiedAccounts={unclassifiedAccounts}
    primaryColor={themeConfig.primary}
    onComplete={() => {
      setShowQCFlow(false);
      loadData(); // 刷新页面数据
    }}
    onDismiss={() => {
      setShowQCFlow(false);
      setQCDismissed(true);
    }}
  />
)}
```

---

### 3.4 新账户创建后重新显示的逻辑

当用户从账户页新建账户返回首页时，`HomePage` 会通过 `params?.refresh` 触发 `loadData()`（现有逻辑，第 99–103 行）。只要在 `loadData()` 中重新计算 `unclassifiedAccounts` 和 `showQuickClassify`，新建的未分类账户就会自动显示入口。

同时，新建账户时应**重置 dismissed 标志**（可在账户保存逻辑中调用 `setQCDismissed(false)`），确保入口重新出现。

---

## 四、整改优先级与文件对照表

### P0（核心定位修正，阻断性）

| 整改项 | 涉及文件 | 核心操作 |
|--------|---------|---------|
| 删除 S/ABCD 等级体系 | `AssetCockpitCard.tsx` | 删除 `GRADE_SCALE`、五段进度条、等级标签 |
| 重构健康概览数字展示 | `AssetCockpitCard.tsx` | 大数字 + 状态文字（复用 `AssetHealthCard` 的工具函数） |
| 修复 `HealthBadge` 缺失问题 | `BadgeComponents.tsx` + `HomePage.tsx` | 删除引用，或补充实现 |
| Quick Classification 基础实现 | `storage.ts` + 新建 `QuickClassifyFlow.tsx` + `HomePage.tsx` | 新增字段、新增组件、接入首页 |

### P1（体验提升）

| 整改项 | 涉及文件 | 核心操作 |
|--------|---------|---------|
| 洞察 Feed 去图标化 | `AssetCockpitCard.tsx` | 改为纯文字样式 |
| 指标卡删除数字评分 | `AssetCockpitCard.tsx` | 删除 `score` 和 `/100` |
| 删除 CTA 色块 | `AssetCockpitCard.tsx` | 删除底部渐变 Banner |

### P2（细节打磨）

| 整改项 | 涉及文件 | 核心操作 |
|--------|---------|---------|
| 人生阶段标签去交互 | `AssetCockpitCard.tsx` | 删除下拉，改为静态标签 |
| `LifeStageSheet` 文案 | `LifeStageSheet.tsx` | 替换"理想区间"相关措辞 |

---

## 五、开发确认事项

以下问题需开发团队在动手前对齐（对应整改报告第十节）：

**Q1. `Account` 接口在哪里定义？**  
→ 从代码搜索来看，`types.ts` 或类似文件中，未在上传的文件中找到完整 `Account` 接口定义。需确认字段位置，然后新增 `assetCategory: 'cash' | 'stable' | 'invest' | 'insure' | null`。

**Q2. 健康评分计算逻辑是否依赖账户分类完成度？**  
→ 当前 `calculateHealthScore`（在 `health-calculator` 中）使用的是账户的 `type` 字段（如 `cash`、`investment`），而非新增的 `assetCategory`。两套映射需保持独立，Quick Classification 仅用于 UI 展示，不影响现有健康评分逻辑。✅ 已解耦，无需修改健康评分逻辑。

**Q3. `HealthScoreCard.tsx` 是否在其他页面使用？**  
→ 首页已确认不使用（首页用的是 `AssetCockpitCard`）。需全局搜索 `HealthScoreCard` 确认其他入口。

**Q4. 用户"暂时跳过/不再提示"的需求？**  
→ 整改报告 6.3 提供了"跳过此账户"选项，但未明确"整体不再提示"。建议：跳过单个账户 → 不存档；整体 Dismiss → 存档 `qc_dismissed=true`，新建账户后自动重置。

---

## 六、附：`AssetHealthCard.tsx` 的定位说明

代码中存在两个相似的卡片组件：
- `AssetCockpitCard.tsx`：**当前在首页实际渲染**，内容更复杂（含等级体系）
- `AssetHealthCard.tsx`：**未在首页渲染**，内容风格**已更接近整改目标**（大数字 + 状态文字 + 纯文字洞察 + 结构横条）

**建议：** 整改 `AssetCockpitCard` 时可以 `AssetHealthCard` 为参照模板，大量逻辑（`getStatusText`、`getStatusColor`、`getTrendText`、`generateInsights`、`getStructureData`）可直接复用或合并，减少重复代码。
