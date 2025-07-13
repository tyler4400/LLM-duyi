# 🚀 MCP 初学者完整指南

## 📚 MCP 基础概念

**MCP（Model Context Protocol）** 是一个让 AI 助手能够安全访问外部工具和数据的协议。简单来说：

- **MCP Server**: 提供工具和资源的服务器
- **MCP Client**: 使用这些工具的客户端（如 AI 助手）

## 🛠️ 创建第一个 MCP 工具

### 1. 项目初始化

```bash
# 创建项目目录
mkdir my-first-mcp-tool
cd my-first-mcp-tool

# 初始化 package.json
npm init -y

# 安装必要依赖
npm install @modelcontextprotocol/sdk
npm install --save-dev typescript @types/node

# 创建 TypeScript 配置
npx tsc --init
```

### 2. 项目结构

```
my-first-mcp-tool/
├── src/
│   ├── index.ts      # 主入口文件
│   ├── server.ts     # MCP 服务器配置
│   └── tools.ts      # 工具定义
├── package.json
└── tsconfig.json
```

### 3. 核心代码实现

#### `src/server.ts` - MCP 服务器配置（官方标准方式）

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

// 创建 MCP 服务器实例
export const server = new McpServer({
  name: 'my-first-mcp-tool',
  version: '1.0.0',
})

// 设置错误处理
server.onerror = (error) => {
  console.error('MCP Server error:', error)
}

// 处理进程退出时的清理
process.on('SIGINT', async () => {
  await server.close()
  process.exit(0)
})
```

#### `src/tools.ts` - 工具定义（官方标准方式）

```typescript
import { server } from './server.js'

// 注册计算器工具
server.tool(
  'calculator',
  'A simple calculator that performs basic arithmetic operations',
  {
    operation: {
      type: 'string',
      enum: ['add', 'subtract', 'multiply', 'divide'],
      description: 'The arithmetic operation to perform',
    },
    a: {
      type: 'number',
      description: 'First number',
    },
    b: {
      type: 'number',
      description: 'Second number',
    },
  },
  async ({ operation, a, b }) => {
    let result: number

    switch (operation) {
      case 'add':
        result = a + b
        break
      case 'subtract':
        result = a - b
        break
      case 'multiply':
        result = a * b
        break
      case 'divide':
        if (b === 0) {
          throw new Error('Division by zero is not allowed')
        }
        result = a / b
        break
      default:
        throw new Error(`Unknown operation: ${operation}`)
    }

    return [
      {
        type: 'text',
        text: `Result: ${a} ${operation} ${b} = ${result}`,
      },
    ]
  }
)

// 注册问候工具
server.tool(
  'greet',
  'Generate a personalized greeting message',
  {
    name: {
      type: 'string',
      description: 'Name of the person to greet',
    },
    language: {
      type: 'string',
      enum: ['en', 'zh', 'es'],
      description: 'Language for the greeting',
      default: 'en',
    },
  },
  async ({ name, language = 'en' }) => {
    const greetings = {
      en: `Hello, ${name}! Welcome to MCP!`,
      zh: `你好，${name}！欢迎使用 MCP！`,
      es: `¡Hola, ${name}! ¡Bienvenido a MCP!`,
    }

    return [
      {
        type: 'text',
        text: greetings[language] || greetings.en,
      },
    ]
  }
)

// 注册时间查询工具
server.tool(
  'get_time',
  'Get the current date and time',
  {}, // 无需输入参数
  async () => {
    const now = new Date()
    const timeString = now.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    return [
      {
        type: 'text',
        text: `Current time: ${timeString}`,
      },
    ]
  }
)
```

#### `src/index.ts` - 主入口文件

```typescript
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { server } from './server.js'
import './tools.js' // 导入以注册工具

async function main() {
  // 创建传输通道用于与 MCP 客户端通信
  const transport = new StdioServerTransport()

  // 连接服务器到传输通道
  await server.connect(transport)

  console.error('My first MCP tool server started! 🚀')
  console.error('Available tools:')
  console.error('- calculator: Basic arithmetic operations')
  console.error('- greet: Personalized greeting messages')
  console.error('- get_time: Current date and time')
}

// 启动服务器
main().catch((error) => {
  console.error('Failed to start MCP server:', error)
  process.exit(1)
})
```

### 4. 配置文件

#### `package.json` 更新

```json
{
  "name": "my-first-mcp-tool",
  "version": "1.0.0",
  "type": "module",
  "main": "build/index.js",
  "bin": {
    "my-first-mcp-tool": "./build/index.js"
  },
  "scripts": {
    "build": "tsc && chmod +x build/index.js",
    "start": "npm run build && node build/index.js",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.15.1"
  },
  "devDependencies": {
    "@types/node": "^24.0.13",
    "typescript": "^5.8.3"
  }
}
```

#### `tsconfig.json` 配置

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "outDir": "./build",
    "rootDir": "./src",
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "build"]
}
```

## 🔧 使用方法

### 1. 构建并运行

```bash
# 构建项目
npm run build

# 启动 MCP 服务器
npm start
```

### 2. 在 Cursor 中配置

创建或编辑 Cursor 的 MCP 配置文件：

**MacOS/Linux:**

```bash
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows:**

```bash
code $env:AppData\Claude\claude_desktop_config.json
```

**配置内容:**

```json
{
  "mcpServers": {
    "my-first-mcp-tool": {
      "command": "node",
      "args": ["path/to/your/project/build/index.js"],
      "name": "我的第一个MCP工具",
      "description": "包含计算器、问候和时间查询功能"
    }
  }
}
```

### 3. 测试工具

启动后，您可以在 Cursor 中通过 AI 助手测试：

```text
用户: 帮我计算 15 + 27
AI: 我来帮您计算... [调用 calculator 工具]
结果: 15 add 27 = 42

用户: 用中文向张三问好
AI: 我来生成问候语... [调用 greet 工具]
结果: 你好，张三！欢迎使用 MCP！

用户: 现在几点了？
AI: 让我查看当前时间... [调用 get_time 工具]
结果: Current time: 2024/01/15 14:30:25
```

## 🎯 关键概念解释

### 1. **工具注册（官方标准方式）**

```typescript
server.tool(
  'tool_name', // 工具名称
  'description', // 工具描述
  {
    // 输入参数schema（JSON Schema格式）
    param1: {
      type: 'string',
      description: '参数描述',
    },
    param2: {
      type: 'number',
      description: '参数描述',
    },
  },
  async (params) => {
    // 工具处理函数
    // 处理逻辑
    return [
      {
        type: 'text',
        text: '结果文本',
      },
    ]
  }
)
```

### 2. **参数定义（JSON Schema）**

```typescript
const paramSchema = {
  requiredParam: {
    type: 'string',
    description: '必需参数',
  },
  optionalParam: {
    type: 'number',
    description: '可选参数',
    default: 0,
  },
  enumParam: {
    type: 'string',
    enum: ['option1', 'option2'],
    description: '枚举参数',
  },
}
```

### 3. **返回格式**

MCP 工具必须返回数组格式：

```typescript
return [
  {
    type: 'text',
    text: 'your result text',
  },
]
```

## 🚀 进阶扩展

### 1. 添加异步操作

```typescript
server.tool(
  'fetch_data',
  'Fetch data from external API',
  {
    url: {
      type: 'string',
      description: 'API endpoint URL',
    },
  },
  async ({ url }) => {
    try {
      const response = await fetch(url)
      const data = await response.json()

      return [
        {
          type: 'text',
          text: JSON.stringify(data, null, 2),
        },
      ]
    } catch (error) {
      return [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ]
    }
  }
)
```

### 2. 添加错误处理

```typescript
server.tool(
  'safe_operation',
  'An operation with proper error handling',
  {
    input: {
      type: 'string',
      description: 'Input data to process',
    },
  },
  async ({ input }) => {
    try {
      // 您的操作逻辑
      const result = processInput(input)

      return [
        {
          type: 'text',
          text: `Success: ${result}`,
        },
      ]
    } catch (error) {
      console.error('Tool error:', error)

      return [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ]
    }
  }
)
```

### 3. 复杂参数示例

```typescript
server.tool(
  'advanced_tool',
  'Tool with complex parameters',
  {
    config: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          description: 'Enable feature',
        },
        threshold: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          description: 'Threshold value',
        },
      },
      required: ['enabled'],
    },
    items: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'List of items to process',
    },
  },
  async ({ config, items }) => {
    // 处理复杂参数
    const result = processComplexData(config, items)

    return [
      {
        type: 'text',
        text: `Processed ${items.length} items with config: ${JSON.stringify(config)}`,
      },
    ]
  }
)
```

## 🔍 正确的官方 API 对比

### 官方标准 vs 错误示例

| 特性         | ✅ 官方标准                                                           | ❌ 错误示例                                                          |
| ------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **导入**     | `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"` | `import { Server } from "@modelcontextprotocol/sdk/server/index.js"` |
| **创建实例** | `new McpServer(config)`                                               | `new Server(config, capabilities)`                                   |
| **工具注册** | `server.tool(name, desc, schema, handler)`                            | `server.addTool({name, description, inputSchema, handler})`          |
| **参数定义** | JSON Schema 格式                                                      | Zod schema                                                           |
| **返回格式** | `[{type: "text", text: "result"}]`                                    | `{content: [{type: "text", text: "result"}]}`                        |
| **兼容性**   | 官方支持，长期维护                                                    | 不是官方标准                                                         |

**建议**: 使用官方标准的 `McpServer` + `server.tool()` 方式，确保最佳兼容性和长期支持。

## 💡 最佳实践

1. **遵循官方标准**：使用 `McpServer` + `server.tool()` 方法和官方的参数格式
2. **清晰的工具描述**：确保工具描述准确，让 AI 能正确理解用途
3. **完整的参数定义**：使用 JSON Schema 详细定义每个参数
4. **错误处理**：始终处理可能的错误情况
5. **日志记录**：添加适当的日志用于调试
6. **模块化设计**：将不同工具分到不同文件中

## 🔧 故障排除

### 常见问题

1. **服务器不显示在 Claude 中**

   - 检查配置文件语法
   - 确保路径是绝对路径
   - 重启 Claude for Desktop

2. **工具调用失败**

   - 检查日志文件
   - 验证服务器构建成功
   - 确保输入参数正确

3. **查看日志**

   ```bash
   # MacOS/Linux
   tail -n 20 -f ~/Library/Logs/Claude/mcp*.log

   # Windows
   # 查看 %AppData%\Claude\mcp*.log
   ```

## 📚 参考资源

- [MCP 官方文档](https://modelcontextprotocol.io/quickstart/server#node)
- [MCP SDK GitHub](https://github.com/modelcontextprotocol/sdk)
- [JSON Schema 文档](https://json-schema.org/)

## 🎯 下一步

基于这个基础，您可以：

1. 创建更复杂的工具
2. 集成外部 API
3. 添加资源和提示功能
4. 部署到生产环境

这个示例严格遵循官方标准，使用 `McpServer` + `server.tool()` 方式，为您提供了创建 MCP 工具的正确框架！
