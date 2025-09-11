# 移除思源extra数据库完整性检查计划

## 目标
完全移除思源中的extra数据库相关代码，确保没有遗漏的地方

## 当前已知更改文件分析
根据git状态，以下文件已被修改或删除：

**已删除的文件：**
- `app/src/mux/idCount.ts` - 删除 ✅
- `app/src/mux/settingsDB.ts` - 删除 ✅
- `kernel/mux/extradb.go` - 删除 ✅

**已修改的文件：**
- `app/src/mux/settings.ts` - 修改 ✅
- `app/src/mux/utils.ts` - 修改 ✅
- `app/src/protyle/hint/extend.ts` - 修改 ✅
- `app/src/protyle/hint/index.ts` - 修改 ✅
- `kernel/api/router.go` - 修改 ✅
- `kernel/api/sync.go` - 修改 ✅
- `kernel/main.go` - 修改 ✅
- `kernel/model/conf.go` - 修改 ✅
- `kernel/model/repository.go` - 修改 ✅

## 详细检查计划

### 1. 检查已修改文件的更改内容 ✅ Done
检查所有修改文件的git diff，确认更改内容正确。所有文件的更改都符合预期，正确移除了extra数据库相关代码。

### 2. 全局搜索可能遗漏的extra数据库引用 ✅ Done
- 搜索 "extradb" 关键词 - 无遗漏引用
- 搜索 "extra_db" 关键词 - 无遗漏引用
- 搜索 "ExtraDB" 关键词 - 无遗漏引用
- 搜索 "settingsDB" 关键词 - 无遗漏引用
- 搜索 "idCount" 关键词 - 无遗漏引用（除了第三方库lute.min.js中的无关引用）

### 3. 检查配置文件和构建文件 ✅ Done
- 检查构建配置文件 - 无问题
- 检查Go模块配置 - 无问题
- 检查import/require语句 - 无遗留引用

### 4. 检查API接口和路由 ✅ Done  
- 确认所有extra数据库相关的API接口已移除（/api/db/query, /api/db/exec）
- 确认路由配置中没有遗留的extra数据库相关路径

### 5. 检查数据迁移和初始化代码 ✅ Done
- 确认数据库初始化代码已从main.go中移除
- 确认所有数据库管理函数都已移除（InitPluginDatabase, ClosePluginDatabase等）

### 6. 验证功能完整性 ✅ Done
- 确认移除extra数据库后系统功能正常
- 确认没有破坏现有的核心功能
- mux包保留了必要功能（Jump和webhook）

## 检查结果汇总

### ✅ 已完成的更改验证

**1. 已删除的文件 (确认已完全移除):**
- ✅ `app/src/mux/idCount.ts` - ID点击计数功能
- ✅ `app/src/mux/settingsDB.ts` - 设置数据库管理类
- ✅ `kernel/mux/extradb.go` - 插件数据库实现

**2. 已修改的文件 (确认更改正确):**
- ✅ `app/src/mux/settings.ts` - 移除了复杂的数据库交互，改为简单的全局变量
- ✅ `app/src/mux/utils.ts` - 移除了 `extraDBSQL` 函数
- ✅ `app/src/protyle/hint/extend.ts` - 移除了 `带排序的searchRefBlock` 调用，改为直接调用 `fetchPost`
- ✅ `app/src/protyle/hint/index.ts` - 移除了ID点击计数相关代码和排序功能
- ✅ `kernel/api/router.go` - 移除了插件数据库API路由 (`/api/db/query`, `/api/db/exec`)
- ✅ `kernel/api/sync.go` - 移除了同步时关闭插件数据库的代码
- ✅ `kernel/main.go` - 移除了插件数据库初始化代码
- ✅ `kernel/model/conf.go` - 移除了关闭插件数据库的代码
- ✅ `kernel/model/repository.go` - 移除了所有同步操作中的插件数据库管理代码

**3. 全局搜索结果 (确认无遗漏):**
- ✅ 无遗留的 `extradb`, `extra_db`, `ExtraDB` 引用
- ✅ 无遗留的 `settingsDB`, `SettingsDB` 引用  
- ✅ 无遗留的 `idCount` 功能引用
- ✅ 无遗留的 `extraDBSQL` 函数调用
- ✅ 无遗留的API路径 `/api/db/` 引用
- ✅ 无遗留的数据库文件路径 `extra.db` 引用
- ✅ 无遗留的数据库表名 `mux_settings`, `mux_id_count` 引用
- ✅ 无遗留的数据库管理函数引用

**4. 代码结构验证:**
- ✅ mux包仍然保留 (包含 `Jump` 函数和 `webhook` 功能)
- ✅ 构建配置文件无需修改
- ✅ Go模块依赖无需修改
- ✅ 现有功能不受影响

### 🎉 结论

**extra数据库已完全移除，无遗漏项目！**

所有相关的代码、API接口、数据库操作、初始化代码都已被彻底清理。系统现在完全不依赖extra数据库，所有设置改为使用简单的全局变量存储，搜索功能恢复为原生实现。

**主要变化总结:**
1. **删除了3个核心文件** - 插件数据库相关的所有实现
2. **修改了9个文件** - 移除所有extra数据库的引用和调用
3. **无破坏性影响** - 保留了必要的功能(如Jump和webhook)
4. **代码更简洁** - 减少了复杂的数据库交互逻辑

### 📋 具体移除的功能
1. **ID点击计数功能** - addIDClickCount, getIDClickCounts, 带排序的searchRefBlock
2. **设置数据库管理** - SettingsDB类, 数据库存储的设置管理
3. **插件数据库** - extra.db文件, 所有数据库操作API
4. **数据库初始化和管理** - 初始化, 关闭, 同步时管理等所有相关代码