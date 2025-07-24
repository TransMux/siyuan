# NocodbConnector 插件使用示例

## 示例1：在普通块中显示Nocodb数据

创建一个段落块，然后为其添加自定义属性：

```
这是一个包含Nocodb数据的块。
```

为这个块添加属性：
- 属性名：`custom-nocodb-table-row-id`
- 属性值：`m7vb2ve7wuh5fld-3`

插件会自动检测这个属性，并在块的protyle-attr区域显示对应的Nocodb数据。

## 示例2：在文档中显示Nocodb数据

为整个文档（根块）添加自定义属性：

- 属性名：`custom-nocodb-table-row-id`
- 属性值：`m7vb2ve7wuh5fld-3`

插件会在文档标题下方创建一个属性面板，显示Nocodb数据。

## 预期的数据显示效果

根据配置的表格结构，插件会显示以下字段：

1. **CreatedAt** (只读字符串)
   - 显示：2025-07-21 10:14:06+00:00

2. **inserted_at** (只读字符串)
   - 显示：2025-07-21 18:19:13+00:00

3. **url** (可编辑链接)
   - 显示：https://mp.weixin.qq.com/s?__biz=MzI3MTA0MTk1MA==&mid=2652611110&idx=1&sn=27804084b891b11f7a7c26c71afc1f49
   - 可点击跳转

4. **status** (只读字符串)
   - 显示：已插入

## 测试步骤

1. 确保Nocodb服务器运行在 `http://server:18866`
2. 确保API令牌 `QCQt9Ud_C9BW3JPG6djcn02XRr57ffi1SgYotFup` 有效
3. 确保表格 `m7vb2ve7wuh5fld` 存在且包含ID为3的记录
4. 在思源笔记中创建块或文档，添加相应的自定义属性
5. 观察插件是否正确显示数据

## 故障排除

### 数据不显示
1. 检查浏览器控制台是否有错误信息
2. 确认Nocodb服务器可访问
3. 确认API令牌有效
4. 确认表格ID和行ID正确

### 数据显示错误
1. 检查表格配置是否与实际结构匹配
2. 确认字段类型配置正确
3. 检查数据格式是否符合预期

### 编辑功能不工作
1. 确认字段配置为可编辑（readonly: false）
2. 检查网络连接
3. 确认API权限允许更新操作

## 开发调试

在浏览器控制台中运行以下命令进行调试：

```javascript
// 运行所有测试
window.nocodbConnectorTests.runAllTests();

// 测试ID解析
window.nocodbConnectorTests.testParseNocodbId();

// 测试字段渲染
window.nocodbConnectorTests.testRenderField();

// 查看插件实例（如果已加载）
console.log(window.siyuan.app.plugins.find(p => p.name === 'nocodbConnector'));
```

## 自定义配置

如需修改配置，编辑 `index.ts` 中的配置对象：

```typescript
this.config = {
    serverUrl: "你的Nocodb服务器地址",
    token: "你的API令牌",
    tableConfigs: {
        "你的表格ID": {
            columns: {
                "字段名": { type: "字段类型", readonly: true/false },
                // 更多字段...
            }
        }
    }
};
```

支持的字段类型：
- `string`: 字符串
- `link`: 链接
- `number`: 数字
- `date`: 日期
- `boolean`: 布尔值
