# NocodbConnector 插件

NocodbConnector 是一个内置插件，用于连接思源笔记和 Nocodb 数据库，在 protyle-attr 和文档属性视图中显示 Nocodb 数据。

## 功能特性

1. **protyle-attr 中显示 Nocodb 数据**：在加载 protyle 之后，检查所有带有 `custom-nocodb-table-row-id` 属性的 block，获取其值并显示对应的 Nocodb 数据。

2. **文档属性视图中显示 Nocodb 数据**：模仿 `mux-doc-heading-attr-panel` 的显示方法，使用思源 AttributeView 的 DOM 结构，在文档属性视图中显示 Nocodb 数据，支持不同类型的字段渲染和在线编辑。

## 配置说明

插件的配置在 `index.ts` 中的 `config` 对象中定义：

```typescript
this.config = {
    serverUrl: "http://server:18866",
    token: "QCQt9Ud_C9BW3JPG6djcn02XRr57ffi1SgYotFup",
    tableConfigs: {
        "m7vb2ve7wuh5fld": {
            columns: {
                "CreatedAt": { type: "string", readonly: true },
                "inserted_at": { type: "string", readonly: true },
                "url": { type: "link", readonly: false },
                "status": { type: "string", readonly: true }
            }
        }
    }
};
```

### 配置项说明

- `serverUrl`: Nocodb 服务器地址
- `token`: Nocodb API 访问令牌
- `tableConfigs`: 表格配置对象
  - 键为表格 ID
  - 值为表格配置，包含 `columns` 对象
  - `columns` 中每个字段包含：
    - `type`: 字段类型（`string`、`link`、`number`、`date`、`boolean`）
    - `readonly`: 是否只读

## 使用方法

### 1. 在 block 中使用

为任意 block 添加 `custom-nocodb-table-row-id` 属性，值的格式为 `{table_id}-{row_id}`，例如：

```
custom-nocodb-table-row-id: m7vb2ve7wuh5fld-3
```

插件会自动检测这个属性，并在 protyle-attr 中显示对应的 Nocodb 数据。

### 2. 在文档中使用

为文档（根 block）添加 `custom-nocodb-table-row-id` 属性，插件会在文档标题下方创建一个属性面板，显示 Nocodb 数据。

## API 调用示例

插件使用以下 API 格式获取数据：

```bash
curl --location 'http://server:18866/api/v2/tables/m7vb2ve7wuh5fld/records/3?fields=CreatedAt%2Curl%2Cstatus%2Cinserted_at' \
--header 'xc-token: QCQt9Ud_C9BW3JPG6djcn02XRr57ffi1SgYotFup'
```

返回的数据格式：

```json
{
    "CreatedAt": "2025-07-21 10:14:06+00:00",
    "url": "https://mp.weixin.qq.com/s?__biz=MzI3MTA0MTk1MA==&mid=2652611110&idx=1&sn=27804084b891b11f7a7c26c71afc1f49",
    "status": "已插入",
    "inserted_at": "2025-07-21 18:19:13+00:00"
}
```

## 字段类型支持

- **string**: 字符串类型，在 AttributeView 中显示为文本输入框
- **link**: 链接类型，渲染为可点击的链接，可编辑时显示为 URL 输入框
- **number**: 数字类型，显示为数字输入框
- **date**: 日期类型，自动格式化显示，使用日期选择器
- **boolean**: 布尔类型，显示为复选框，可点击切换状态

## DOM 结构

插件使用思源 AttributeView 的标准 DOM 结构：

```html
<div data-av-id="nocodb-{tableId}" data-av-type="table" data-node-id="{rowId}" data-type="NodeAttributeView">
    <div class="custom-attr__avheader">
        <div class="block__logo popover__block">
            <svg class="block__logoicon"><use xlink:href="#iconDatabase"></use></svg>
            <span class="fn__ellipsis">🗄️ Nocodb 数据</span>
        </div>
    </div>
    <div class="block__icons av__row" data-id="{rowId}" data-col-id="nocodb-{columnName}">
        <div class="block__icon" draggable="true">
            <svg><use xlink:href="#iconDrag"></use></svg>
        </div>
        <div class="block__logo ariaLabel fn__pointer">
            <!-- 字段图标和名称 -->
        </div>
        <div class="fn__flex-1 fn__flex custom-attr__avvalue">
            <!-- 字段值 -->
        </div>
    </div>
</div>
```

## 文件结构

```
NocodbConnector/
├── index.ts          # 主插件文件
├── utils.ts          # 工具函数和 API 客户端
├── test.ts           # 测试文件
└── README.md         # 说明文档
```

## 开发说明

### 主要类和方法

- `NocodbConnectorPlugin`: 主插件类
- `NocodbApiClient`: API 客户端类
- `parseNocodbId()`: 解析 Nocodb ID 的工具函数
- `renderField()`: 渲染字段的工具函数

### 事件监听

插件监听以下事件：
- `loaded-protyle-static`: protyle 加载完成
- `switch-protyle`: protyle 切换

### 错误处理

插件包含完善的错误处理机制：
- API 调用失败时显示错误状态
- 单个 block 处理失败不影响其他 block
- 配置验证和警告提示

## 测试

运行测试：

```javascript
// 在浏览器控制台中运行
window.nocodbConnectorTests.runAllTests();
```

## 注意事项

1. 确保 Nocodb 服务器可访问
2. 确保 API 令牌有效
3. 表格 ID 和行 ID 必须正确
4. 字段配置必须与实际表格结构匹配

## 更新日志

- v1.1.0: 重构文档属性面板，使用思源 AttributeView 的标准 DOM 结构，改进用户体验
- v1.0.0: 初始版本，支持基本的数据显示和编辑功能
