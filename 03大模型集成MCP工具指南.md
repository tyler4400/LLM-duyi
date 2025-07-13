# 🤖 大模型集成 MCP 工具完整指南

## 📚 核心概念

大模型使用 MCP 工具的完整流程：

1. **工具发现**：从 MCP Server 获取可用工具列表
2. **格式转换**：将 MCP 工具格式转换为 OpenAI Function Calling 格式
3. **工具调用**：大模型决定调用哪些工具
4. **MCP 执行**：通过 MCP Client 调用实际工具
5. **结果处理**：将工具结果返回给大模型生成最终回答

## 🛠️ 完整实现

### 1. MCP 工具到 OpenAI 格式转换器

```typescript
// mcp-to-openai-converter.ts
import { MCPServerManager } from './multi-server-manager.js'

interface OpenAIFunction {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, any>
      required: string[]
    }
  }
}

class MCPToOpenAIConverter {
  constructor(private mcpManager: MCPServerManager) {}

  // 将MCP工具转换为OpenAI Function格式
  convertMCPToolToOpenAIFunction(mcpTool: any): OpenAIFunction {
    return {
      type: 'function',
      function: {
        name: mcpTool.name,
        description: mcpTool.description || mcpTool.name,
        parameters: this.convertMCPSchemaToOpenAI(mcpTool.inputSchema),
      },
    }
  }

  // 转换参数schema
  private convertMCPSchemaToOpenAI(mcpSchema: any): any {
    if (!mcpSchema) {
      return {
        type: 'object',
        properties: {},
        required: [],
      }
    }

    // 如果是Zod schema，需要转换
    if (mcpSchema._def) {
      return this.convertZodToOpenAI(mcpSchema)
    }

    // 如果已经是JSON Schema格式
    if (mcpSchema.type === 'object' || typeof mcpSchema === 'object') {
      return this.convertJSONSchemaToOpenAI(mcpSchema)
    }

    // 直接处理属性对象格式
    const properties: Record<string, any> = {}
    const required: string[] = []

    for (const [key, value] of Object.entries(mcpSchema)) {
      if (typeof value === 'object' && value !== null) {
        const prop = value as any
        properties[key] = {
          type: prop.type || 'string',
          description: prop.description || `${key} parameter`,
          ...(prop.enum && { enum: prop.enum }),
          ...(prop.default !== undefined && { default: prop.default }),
        }

        // 检查是否必需（没有default值且没有标记为optional）
        if (prop.default === undefined && !prop.optional) {
          required.push(key)
        }
      }
    }

    return {
      type: 'object',
      properties,
      required,
    }
  }

  private convertZodToOpenAI(zodSchema: any): any {
    // 简化的Zod转换逻辑
    return {
      type: 'object',
      properties: {},
      required: [],
    }
  }

  private convertJSONSchemaToOpenAI(jsonSchema: any): any {
    return {
      type: 'object',
      properties: jsonSchema.properties || {},
      required: jsonSchema.required || [],
    }
  }

  // 获取所有可用的OpenAI格式函数
  async getOpenAIFunctions(): Promise<OpenAIFunction[]> {
    try {
      const allTools = await this.mcpManager.getAllAvailableTools()
      const functions: OpenAIFunction[] = []

      for (const [serverName, tools] of Object.entries(allTools.tools_by_server)) {
        for (const tool of tools) {
          const openaiFunc = this.convertMCPToolToOpenAIFunction(tool.function)
          functions.push(openaiFunc)
        }
      }

      console.log(`🔧 转换了 ${functions.length} 个MCP工具为OpenAI函数格式`)
      return functions
    } catch (error) {
      console.error('❌ 获取OpenAI函数失败:', error)
      return []
    }
  }

  // 执行工具调用
  async executeToolCall(toolCall: any): Promise<string> {
    try {
      const { name: functionName, arguments: args } = toolCall.function
      console.log(`🛠️ 执行工具: ${functionName}`, args)

      // 解析参数
      const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args

      // 通过MCP调用工具
      const result = await this.mcpManager.callTool(functionName, parsedArgs)

      console.log(`✅ 工具执行成功: ${result}`)
      return result
    } catch (error) {
      console.error(`❌ 工具执行失败:`, error)
      return `错误：${error.message}`
    }
  }
}

export { MCPToOpenAIConverter }
```

### 2. OpenAI 集成的完整聊天服务

```typescript
// openai-mcp-integration.ts
import OpenAI from 'openai'
import { MCPServerManager } from './multi-server-manager.js'
import { MCPToOpenAIConverter } from './mcp-to-openai-converter.js'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
  name?: string
}

interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

class OpenAIMCPService {
  private openai: OpenAI
  private mcpManager: MCPServerManager
  private converter: MCPToOpenAIConverter
  private conversations: ChatMessage[] = []

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.deepseek.com/v1', // 使用DeepSeek API
    })

    this.mcpManager = new MCPServerManager()
    this.converter = new MCPToOpenAIConverter(this.mcpManager)

    // 初始化MCP连接
    this.initializeMCP()
  }

  // 初始化MCP服务器连接
  private async initializeMCP() {
    try {
      // 连接到计算器服务器
      await this.mcpManager.connectToServer('calculator', {
        command: 'node',
        args: ['./my-first-mcp-tool/build/index.js'],
      })

      // 连接到天气服务器（如果有的话）
      await this.mcpManager.connectToServer('weather', {
        command: 'node',
        args: ['./weather-mcp-server/build/index.js'],
      })

      // 构建工具映射
      await this.mcpManager.buildToolMapping()

      console.log('🚀 MCP服务器初始化完成')
    } catch (error) {
      console.error('❌ MCP初始化失败:', error)
    }
  }

  // 处理聊天请求（支持工具调用）
  async chat(userMessage: string): Promise<string> {
    try {
      // 添加用户消息到对话历史
      this.conversations.push({
        role: 'user',
        content: userMessage,
      })

      // 获取可用的OpenAI格式函数
      const availableFunctions = await this.converter.getOpenAIFunctions()

      console.log(`📋 可用函数: ${availableFunctions.map((f) => f.function.name).join(', ')}`)

      // 构建消息数组
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content:
            '你是一个智能助手，可以使用提供的工具来帮助用户。请根据用户的需求选择合适的工具。',
        },
        ...this.conversations,
      ]

      // 第一次调用：让AI决定是否需要使用工具
      console.log('🤖 调用OpenAI API...')
      const firstResponse = await this.openai.chat.completions.create({
        model: 'deepseek-chat',
        messages: messages,
        tools: availableFunctions,
        tool_choice: 'auto', // 让AI自动决定是否使用工具
        temperature: 0.7,
      })

      const assistantMessage = firstResponse.choices[0].message

      // 如果AI决定调用工具
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        console.log(`🛠️ AI决定调用 ${assistantMessage.tool_calls.length} 个工具`)

        // 添加AI的消息到对话历史
        messages.push({
          role: 'assistant',
          content: assistantMessage.content || '',
        })

        // 执行所有工具调用
        for (const toolCall of assistantMessage.tool_calls) {
          console.log(`🔧 执行工具: ${toolCall.function.name}`)

          // 通过MCP执行工具
          const toolResult = await this.converter.executeToolCall(toolCall)

          // 添加工具结果到消息历史
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: toolResult,
          })
        }

        // 第二次调用：基于工具结果生成最终回答
        console.log('🤖 基于工具结果生成最终回答...')
        const finalResponse = await this.openai.chat.completions.create({
          model: 'deepseek-chat',
          messages: messages,
          temperature: 0.7,
        })

        const finalAnswer = finalResponse.choices[0].message.content || '抱歉，我无法生成回答。'

        // 添加最终回答到对话历史
        this.conversations.push({
          role: 'assistant',
          content: finalAnswer,
        })

        return finalAnswer
      } else {
        // 如果不需要工具，直接返回回答
        const directAnswer = assistantMessage.content || '抱歉，我无法回答这个问题。'

        this.conversations.push({
          role: 'assistant',
          content: directAnswer,
        })

        return directAnswer
      }
    } catch (error) {
      console.error('❌ 聊天处理失败:', error)
      return '抱歉，处理您的请求时出现了错误。'
    }
  }

  // 流式聊天（支持实时返回）
  async chatStream(userMessage: string, onChunk: (chunk: string) => void): Promise<void> {
    try {
      this.conversations.push({
        role: 'user',
        content: userMessage,
      })

      const availableFunctions = await this.converter.getOpenAIFunctions()

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: '你是一个智能助手，可以使用提供的工具来帮助用户。',
        },
        ...this.conversations,
      ]

      // 第一次调用：检查是否需要工具
      const firstResponse = await this.openai.chat.completions.create({
        model: 'deepseek-chat',
        messages: messages,
        tools: availableFunctions,
        tool_choice: 'auto',
      })

      const assistantMessage = firstResponse.choices[0].message

      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // 需要调用工具
        onChunk('🛠️ 正在调用工具处理您的请求...\n\n')

        messages.push({
          role: 'assistant',
          content: assistantMessage.content || '',
        })

        // 执行工具调用
        for (const toolCall of assistantMessage.tool_calls) {
          onChunk(`🔧 正在执行: ${toolCall.function.name}\n`)

          const toolResult = await this.converter.executeToolCall(toolCall)

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: toolResult,
          })
        }

        onChunk('\n📝 正在生成回答...\n\n')

        // 流式生成最终回答
        const stream = await this.openai.chat.completions.create({
          model: 'deepseek-chat',
          messages: messages,
          stream: true,
        })

        let fullResponse = ''
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || ''
          if (content) {
            fullResponse += content
            onChunk(content)
          }
        }

        this.conversations.push({
          role: 'assistant',
          content: fullResponse,
        })
      } else {
        // 直接流式返回
        const stream = await this.openai.chat.completions.create({
          model: 'deepseek-chat',
          messages: messages,
          stream: true,
        })

        let fullResponse = ''
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || ''
          if (content) {
            fullResponse += content
            onChunk(content)
          }
        }

        this.conversations.push({
          role: 'assistant',
          content: fullResponse,
        })
      }
    } catch (error) {
      console.error('❌ 流式聊天失败:', error)
      onChunk('\n❌ 处理请求时出现错误')
    }
  }

  // 清除对话历史
  clearConversation() {
    this.conversations = []
    console.log('🗑️ 对话历史已清除')
  }

  // 获取对话历史
  getConversationHistory() {
    return this.conversations
  }

  // 清理资源
  async cleanup() {
    await this.mcpManager.cleanup()
  }
}

export { OpenAIMCPService }
```

### 3. Express.js API 集成

```javascript
// express-openai-mcp.js
const express = require('express')
const { OpenAIMCPService } = require('./openai-mcp-integration')

const app = express()
app.use(express.json())

// 创建OpenAI MCP服务实例
const openaiMCPService = new OpenAIMCPService(process.env.DEEPSEEK_API_KEY)

// API: 普通聊天
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body
    const response = await openaiMCPService.chat(message)

    res.json({
      success: true,
      response: response,
    })
  } catch (error) {
    console.error('聊天API错误:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// API: 流式聊天
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { message } = req.body

    // 设置流式响应头
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')

    // 流式处理回调
    const onChunk = (chunk) => {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
    }

    // 执行流式聊天
    await openaiMCPService.chatStream(message, onChunk)

    // 结束流
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (error) {
    console.error('流式聊天API错误:', error)
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`)
    res.end()
  }
})

// API: 清除对话历史
app.post('/api/chat/clear', (req, res) => {
  try {
    openaiMCPService.clearConversation()
    res.json({
      success: true,
      message: '对话历史已清除',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// API: 获取对话历史
app.get('/api/chat/history', (req, res) => {
  try {
    const history = openaiMCPService.getConversationHistory()
    res.json({
      success: true,
      history: history,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 OpenAI MCP 服务运行在端口 ${PORT}`)
  console.log('📋 可用API端点:')
  console.log('  POST /api/chat - 普通聊天')
  console.log('  POST /api/chat/stream - 流式聊天')
  console.log('  POST /api/chat/clear - 清除历史')
  console.log('  GET /api/chat/history - 获取历史')
})

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('正在关闭服务...')
  await openaiMCPService.cleanup()
  process.exit(0)
})
```

### 4. 前端使用示例

```javascript
// frontend-usage.js
class ChatClient {
  constructor(baseURL = '/api') {
    this.baseURL = baseURL
  }

  // 普通聊天
  async chat(message) {
    try {
      const response = await fetch(`${this.baseURL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      })

      const data = await response.json()
      return data.response
    } catch (error) {
      console.error('聊天请求失败:', error)
      throw error
    }
  }

  // 流式聊天
  async chatStream(message, onChunk) {
    try {
      const response = await fetch(`${this.baseURL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter((line) => line.trim())

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                onChunk(parsed.content)
              }
            } catch (e) {
              console.error('解析流数据失败:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('流式聊天失败:', error)
      throw error
    }
  }

  // 清除对话
  async clearHistory() {
    await fetch(`${this.baseURL}/chat/clear`, { method: 'POST' })
  }
}

// 使用示例
const chatClient = new ChatClient()

// 测试工具调用
async function testToolCalls() {
  console.log('🧮 测试计算器工具:')
  const mathResult = await chatClient.chat('帮我计算 15 + 27')
  console.log('回答:', mathResult)

  console.log('\n⏰ 测试时间工具:')
  const timeResult = await chatClient.chat('现在几点了？')
  console.log('回答:', timeResult)

  console.log('\n💬 测试普通对话:')
  const chatResult = await chatClient.chat('你好，介绍一下你自己')
  console.log('回答:', chatResult)
}

// 测试流式对话
async function testStreamChat() {
  console.log('🌊 测试流式聊天:')

  let fullResponse = ''
  await chatClient.chatStream('帮我计算 100 * 25，然后用中文跟我打个招呼', (chunk) => {
    process.stdout.write(chunk)
    fullResponse += chunk
  })

  console.log('\n完整回答:', fullResponse)
}

// 运行测试
if (require.main === module) {
  testToolCalls().then(() => testStreamChat())
}

export { ChatClient }
```

### 5. 环境配置

```bash
# .env
DEEPSEEK_API_KEY=your_deepseek_api_key_here
PORT=3000
NODE_ENV=development
```

```json
// package.json
{
  "name": "openai-mcp-integration",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.15.1",
    "openai": "^4.0.0",
    "express": "^4.18.0",
    "dotenv": "^16.0.0"
  },
  "scripts": {
    "start": "node express-openai-mcp.js",
    "test": "node frontend-usage.js"
  }
}
```

## 🚀 完整工作流程

### 1. 启动流程

```bash
# 1. 启动MCP Server
cd my-first-mcp-tool
npm run start &

# 2. 启动集成服务
cd openai-mcp-integration
npm start
```

### 2. 调用示例

```bash
# 测试计算器工具
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "帮我计算 25 * 4"}'

# 测试时间工具
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "现在几点了？"}'

# 测试普通对话
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "你好，介绍一下你自己"}'
```

## 🎯 核心优势

1. **智能工具选择**：大模型自动决定何时使用哪个工具
2. **无缝集成**：MCP 工具透明地集成到对话流中
3. **实时响应**：支持流式对话和工具调用
4. **错误处理**：完善的错误处理和降级机制
5. **扩展性**：易于添加新的 MCP 工具

这样，您就有了一个完整的大模型+MCP 工具的集成解决方案！🚀
