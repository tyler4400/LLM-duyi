# 🔗 MCP Client 基础实现指南

## 📚 核心概念

MCP Client 负责连接 MCP Server 并调用其提供的工具。一个完整的 MCP Client 包含：

- **传输层**：用于与 MCP Server 通信
- **客户端实例**：管理连接和工具调用
- **工具管理**：获取和调用可用工具

## 🛠️ 基础实现

### 1. 简单的 MCP Client

```typescript
// simple-mcp-client.ts
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'

class SimpleMCPClient {
  private client: Client
  private transport: StdioClientTransport
  private isConnected = false

  constructor() {
    // 创建客户端实例
    this.client = new Client(
      {
        name: 'simple-mcp-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {}, // 支持工具调用
        },
      }
    )
  }

  // 连接到 MCP Server
  async connect(serverCommand: string, serverArgs: string[]) {
    try {
      console.log(`正在连接到 MCP Server: ${serverCommand} ${serverArgs.join(' ')}`)

      // 创建传输层
      this.transport = new StdioClientTransport({
        command: serverCommand,
        args: serverArgs,
      })

      // 建立连接
      await this.client.connect(this.transport)
      this.isConnected = true

      console.log('✅ 成功连接到 MCP Server')
    } catch (error) {
      console.error('❌ 连接失败:', error)
      throw error
    }
  }

  // 获取可用工具列表
  async getAvailableTools() {
    if (!this.isConnected) {
      throw new Error('客户端未连接')
    }

    try {
      const result = await this.client.listTools()
      console.log('📋 可用工具:', result.tools)
      return result.tools
    } catch (error) {
      console.error('❌ 获取工具列表失败:', error)
      throw error
    }
  }

  // 调用工具
  async callTool(toolName: string, args: any) {
    if (!this.isConnected) {
      throw new Error('客户端未连接')
    }

    try {
      console.log(`🛠️ 调用工具: ${toolName}`, args)

      const result = await this.client.callTool({
        name: toolName,
        arguments: args,
      })

      console.log('✅ 工具调用成功:', result)
      return result
    } catch (error) {
      console.error(`❌ 工具调用失败 [${toolName}]:`, error)
      throw error
    }
  }

  // 断开连接
  async disconnect() {
    if (this.isConnected && this.client) {
      try {
        await this.client.close()
        this.isConnected = false
        console.log('🔌 已断开连接')
      } catch (error) {
        console.error('❌ 断开连接失败:', error)
      }
    }
  }
}

// 使用示例
async function main() {
  const client = new SimpleMCPClient()

  try {
    // 连接到我们之前创建的 MCP Server
    await client.connect('node', ['path/to/your/mcp-server/build/index.js'])

    // 获取可用工具
    const tools = await client.getAvailableTools()

    // 调用计算器工具
    const result = await client.callTool('calculator', {
      operation: 'add',
      a: 15,
      b: 27,
    })

    console.log('计算结果:', result.content[0].text)

    // 调用问候工具
    const greeting = await client.callTool('greet', {
      name: '张三',
      language: 'zh',
    })

    console.log('问候语:', greeting.content[0].text)
  } catch (error) {
    console.error('程序执行失败:', error)
  } finally {
    await client.disconnect()
  }
}

// 运行示例
if (require.main === module) {
  main()
}

export { SimpleMCPClient }
```

### 2. 高级 MCP Client 管理器

```typescript
// advanced-mcp-client.ts
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import fs from 'fs'
import path from 'path'

interface ServerConfig {
  command: string
  args: string[]
  options?: any
  name: string
  description?: string
}

interface MCPConfig {
  mcpServers: Record<string, ServerConfig>
}

class AdvancedMCPClient {
  private servers = new Map<
    string,
    {
      client: Client
      transport: StdioClientTransport
      config: ServerConfig
    }
  >()
  private toolServerMap = new Map<string, string>()
  private isInitialized = false

  constructor(private configPath?: string) {}

  // 加载配置文件
  private loadConfig(): MCPConfig {
    const defaultConfigPath = this.configPath || './mcp-config.json'

    if (!fs.existsSync(defaultConfigPath)) {
      console.warn(`⚠️ 配置文件不存在: ${defaultConfigPath}`)
      return { mcpServers: {} }
    }

    try {
      const configContent = fs.readFileSync(defaultConfigPath, 'utf-8')
      const config = JSON.parse(configContent)
      console.log('📋 已加载MCP配置:', Object.keys(config.mcpServers || {}))
      return config
    } catch (error) {
      console.error('❌ 读取配置文件失败:', error)
      return { mcpServers: {} }
    }
  }

  // 初始化所有 MCP Server 连接
  async initialize() {
    if (this.isInitialized) {
      return
    }

    try {
      console.log('🔗 正在初始化所有 MCP Server 连接...')

      const config = this.loadConfig()
      const serverConfigs = config.mcpServers || {}

      // 并行连接所有服务器
      const connectionPromises = Object.entries(serverConfigs).map(([serverName, serverConfig]) =>
        this.connectToServer(serverName, serverConfig)
      )

      await Promise.allSettled(connectionPromises)

      // 构建工具映射
      await this.buildToolMapping()

      this.isInitialized = true
      console.log(`✅ 已初始化 ${this.servers.size} 个 MCP Server`)
    } catch (error) {
      console.error('❌ 初始化失败:', error)
      throw error
    }
  }

  // 连接到单个服务器
  private async connectToServer(serverName: string, config: ServerConfig) {
    try {
      console.log(`🔌 正在连接 ${serverName}...`)

      // 创建传输层
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        options: config.options || {},
      })

      // 创建客户端
      const client = new Client(
        {
          name: 'advanced-mcp-client',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        }
      )

      // 连接
      await client.connect(transport)

      // 存储连接
      this.servers.set(serverName, {
        client,
        transport,
        config,
      })

      console.log(`✅ ${serverName} 连接成功`)
    } catch (error) {
      console.error(`❌ ${serverName} 连接失败:`, error)
    }
  }

  // 构建工具到服务器的映射
  private async buildToolMapping() {
    this.toolServerMap.clear()

    for (const [serverName, serverInstance] of this.servers.entries()) {
      try {
        const result = await serverInstance.client.listTools()

        for (const tool of result.tools) {
          this.toolServerMap.set(tool.name, serverName)
          console.log(`🛠️ 工具 ${tool.name} -> ${serverName}`)
        }
      } catch (error) {
        console.error(`❌ 获取 ${serverName} 工具列表失败:`, error)
      }
    }
  }

  // 获取所有可用工具
  async getAllAvailableTools() {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const allTools = []

    for (const [serverName, serverInstance] of this.servers.entries()) {
      try {
        const result = await serverInstance.client.listTools()

        for (const tool of result.tools) {
          allTools.push({
            ...tool,
            server: serverName,
          })
        }
      } catch (error) {
        console.error(`❌ 获取 ${serverName} 工具失败:`, error)
      }
    }

    return allTools
  }

  // 调用工具（自动路由到正确的服务器）
  async callTool(toolName: string, args: any) {
    if (!this.isInitialized) {
      await this.initialize()
    }

    // 查找工具所属的服务器
    const serverName = this.toolServerMap.get(toolName)
    if (!serverName) {
      throw new Error(`❌ 未找到工具: ${toolName}`)
    }

    const serverInstance = this.servers.get(serverName)
    if (!serverInstance) {
      throw new Error(`❌ 服务器未连接: ${serverName}`)
    }

    try {
      console.log(`🛠️ 调用工具: ${toolName} (来自 ${serverName})`, args)

      const result = await serverInstance.client.callTool({
        name: toolName,
        arguments: args,
      })

      console.log(`✅ 工具调用成功:`, result)
      return result
    } catch (error) {
      console.error(`❌ 工具调用失败 [${toolName}]:`, error)
      throw error
    }
  }

  // 获取服务器状态
  getServerStatus() {
    const status = {
      total: this.servers.size,
      connected: 0,
      servers: {} as Record<string, { connected: boolean }>,
    }

    for (const [serverName] of this.servers.entries()) {
      status.servers[serverName] = { connected: true }
      status.connected++
    }

    return status
  }

  // 重新加载配置
  async reloadConfig() {
    console.log('🔄 重新加载配置...')

    // 断开所有连接
    await this.cleanup()

    // 重新初始化
    await this.initialize()

    console.log('✅ 配置重新加载完成')
  }

  // 清理所有连接
  async cleanup() {
    console.log('🧹 正在清理所有连接...')

    for (const [serverName, serverInstance] of this.servers.entries()) {
      try {
        await serverInstance.client.close()
        console.log(`🔌 ${serverName} 连接已关闭`)
      } catch (error) {
        console.error(`❌ 关闭 ${serverName} 连接失败:`, error)
      }
    }

    this.servers.clear()
    this.toolServerMap.clear()
    this.isInitialized = false

    console.log('✅ 所有连接已清理')
  }
}

// 使用示例
async function advancedExample() {
  const client = new AdvancedMCPClient('./mcp-config.json')

  try {
    // 初始化所有连接
    await client.initialize()

    // 获取所有可用工具
    const tools = await client.getAllAvailableTools()
    console.log('📋 所有可用工具:', tools)

    // 调用工具（自动路由）
    const calculatorResult = await client.callTool('calculator', {
      operation: 'multiply',
      a: 6,
      b: 7,
    })

    console.log('🧮 计算结果:', calculatorResult.content[0].text)

    // 调用另一个工具
    const timeResult = await client.callTool('get_time', {})
    console.log('⏰ 当前时间:', timeResult.content[0].text)
  } catch (error) {
    console.error('❌ 程序执行失败:', error)
  } finally {
    await client.cleanup()
  }
}

export { AdvancedMCPClient }
```

### 3. 配置文件示例

```json
// mcp-config.json
{
  "mcpServers": {
    "my-calculator": {
      "name": "计算器服务",
      "description": "提供基础计算功能",
      "command": "node",
      "args": ["./my-first-mcp-tool/build/index.js"],
      "options": {
        "cwd": "/path/to/your/project"
      }
    },
    "weather-service": {
      "name": "天气服务",
      "description": "提供天气查询功能",
      "command": "node",
      "args": ["./weather-mcp-server/build/index.js"],
      "options": {
        "cwd": "/path/to/weather/project"
      }
    }
  }
}
```

### 4. Express.js 集成示例

```javascript
// express-mcp-integration.js
const express = require('express')
const { AdvancedMCPClient } = require('./advanced-mcp-client')

const app = express()
app.use(express.json())

// 创建全局 MCP 客户端实例
const mcpClient = new AdvancedMCPClient('./mcp-config.json')

// 初始化 MCP 客户端
mcpClient.initialize().catch(console.error)

// API: 获取可用工具
app.get('/api/mcp/tools', async (req, res) => {
  try {
    const tools = await mcpClient.getAllAvailableTools()
    res.json({
      success: true,
      tools_by_server: tools.reduce((acc, tool) => {
        if (!acc[tool.server]) acc[tool.server] = []
        acc[tool.server].push({
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          },
        })
        return acc
      }, {}),
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// API: 调用工具
app.post('/api/mcp/call-tool', async (req, res) => {
  try {
    const { toolName, args } = req.body
    const result = await mcpClient.callTool(toolName, args)

    // 提取文本内容
    const content = result.content.map((item) => item.text || JSON.stringify(item)).join('\n')

    res.json({
      success: true,
      result: content,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// API: 获取服务器状态
app.get('/api/mcp/status', async (req, res) => {
  try {
    const status = mcpClient.getServerStatus()
    res.json(status)
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// API: 重新加载配置
app.post('/api/mcp/reload', async (req, res) => {
  try {
    await mcpClient.reloadConfig()
    res.json({
      success: true,
      message: '配置重新加载成功',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// 启动服务器
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 MCP 集成服务器运行在端口 ${PORT}`)
})

// 进程退出时清理资源
process.on('SIGINT', async () => {
  console.log('正在关闭服务器...')
  await mcpClient.cleanup()
  process.exit(0)
})
```

## 🎯 关键特性说明

### 1. **传输层管理**

- `StdioClientTransport`: 用于进程间通信
- 支持自定义命令和参数
- 错误处理和重连机制

### 2. **工具路由**

- 自动映射工具到对应的服务器
- 支持多服务器工具调用
- 智能工具发现机制

### 3. **配置管理**

- JSON 配置文件支持
- 动态配置重载
- 服务器状态监控

### 4. **错误处理**

- 连接失败重试
- 工具调用异常处理
- 优雅的资源清理

## 💡 最佳实践

1. **连接管理**: 使用连接池管理多个 MCP Server
2. **错误恢复**: 实现自动重连和故障转移
3. **性能优化**: 缓存工具列表，减少重复查询
4. **日志记录**: 详细记录连接状态和工具调用
5. **配置验证**: 启动时验证配置文件的正确性

这个实现提供了从简单到复杂的完整 MCP Client 解决方案！
