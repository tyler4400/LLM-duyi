# 🛡️ Check Dependency - MCP 安全审计工具

一个基于 Model Context Protocol (MCP) 的 Node.js 依赖安全审计工具，专为现代 AI 开发环境设计。

## 🚀 项目简介

Check Dependency 是一个专业的依赖安全审计工具，通过 MCP 协议为 AI 助手提供实时的依赖安全检查功能。该工具调用 npm 官方安全审计 API，能够快速识别项目中的安全漏洞，并提供详细的修复建议。

### ✨ 核心特性

- 🔍 **实时安全审计**: 调用 npm 官方 API 进行依赖安全检查
- 📊 **详细漏洞报告**: 提供漏洞等级、描述、修复建议等完整信息
- 🤖 **AI 集成友好**: 基于 MCP 协议，完美集成到 Cursor 等 AI 开发工具
- ⚡ **批量处理**: 支持同时审计多个依赖项
- 🛠️ **开箱即用**: 简单配置即可开始使用
- 🔄 **智能重试**: 内置重试机制，确保审计结果的可靠性

## 📦 安装

### 前置要求

- Node.js >= 18.0.0
- npm >= 8.0.0

### 安装步骤

```bash
# 克隆仓库
git clone <repository-url>
cd check-dependency

# 安装依赖
npm install

# 构建项目
npm run build
```

## 🔧 使用方法

### 1. 命令行使用

```bash
# 直接运行
node build/index.js

# 或使用 npm 脚本
npm run build && node build/index.js
```

### 2. 作为 MCP 工具使用

该工具主要设计为 MCP 工具，通过以下方式调用：

```typescript
// 调用审计工具
const result = await mcpClient.call('audit_it', {
  dependencies: {
    react: '^18.2.0',
    axios: '^1.6.7',
    lodash: '4.17.21',
  },
})
```

## 🎯 在 AI 开发工具中使用

### Cursor 集成

Cursor 是一个强大的 AI 代码编辑器，支持 MCP 协议。以下是集成步骤：

#### 1. 配置 MCP 服务器

在 Cursor 的配置文件中添加：

```json
{
  "mcpServers": {
    "check-dependency": {
      "command": "node",
      "args": ["<path-to-project>/build/index.js"],
      "name": "依赖安全审计",
      "description": "检查项目依赖的安全漏洞"
    }
  }
}
```

#### 2. 启动服务

```bash
# 构建并启动服务
npm run build
node build/index.js
```

#### 3. 在 Cursor 中使用

现在您可以在 Cursor 中通过 AI 助手使用依赖审计功能：

```
请帮我审计当前项目的依赖安全性
```

AI 助手将自动调用 `audit_it` 工具，分析您的 `package.json` 文件并返回详细的安全报告。

### 其他 MCP 兼容工具

该工具理论上兼容所有支持 MCP 协议的工具，包括：

- Claude Desktop
- 其他基于 MCP 的 AI 助手
- 自定义的 MCP 客户端

## 📋 API 文档

### audit_it 工具

**描述**: 审计项目依赖的安全漏洞

**参数**:

```typescript
{
  dependencies: Record<string, string> // 依赖对象，键为包名，值为版本号
}
```

**返回值**:

```typescript
{
  content: Array<{
    type: 'text'
    text: string // JSON 格式的漏洞信息数组
  }>
}
```

### 漏洞信息结构

```typescript
interface Vulnerability {
  name: string // 漏洞所在的包名
  version: string // 受影响的版本范围
  severity: 'critical' | 'high' | 'moderate' | 'low' // 漏洞等级
  description: string // 漏洞描述
  recommendation: string // 官方修复建议
  fixAvailable: boolean // 是否存在修复版本
  fixedVersion?: string // 修复了该漏洞的版本
  githubAdvisoryId?: string // GitHub 漏洞数据库编号
  updatedAt?: string // 漏洞信息最后更新时间
  moreInfo?: string // 详细信息链接
}
```

## 🏗️ 项目架构

```
src/
├── index.ts       # 主入口文件，启动 MCP 服务器
├── server.ts      # MCP 服务器配置
├── tools.ts       # 工具注册和路由
├── security.ts    # 核心安全审计逻辑
└── types.ts       # TypeScript 类型定义
```

### 核心组件

1. **MCP 服务器**: 基于 `@modelcontextprotocol/sdk` 构建
2. **安全审计器**: `SecurityAuditHandler` 类处理所有审计逻辑
3. **npm API 集成**: 使用 `npm-registry-fetch` 调用官方 API
4. **类型安全**: 使用 `zod` 进行参数验证

## 🔒 安全特性

- ✅ **输入验证**: 严格的包名和版本号格式校验
- ✅ **错误处理**: 完整的错误处理和 MCP 错误转换
- ✅ **API 限制**: 内置重试机制和超时保护
- ✅ **数据清洗**: 对 npm API 返回数据进行安全过滤

## 🚀 高级用法

### 自定义配置

您可以通过修改 `src/security.ts` 中的配置来自定义审计行为：

```typescript
// 修改 API 调用参数
const result = await npmFetch.json('/-/npm/v1/security/audits', {
  method: 'POST',
  body: auditData,
  gzip: true,
  timeout: 30000, // 自定义超时时间
  retry: {
    retries: 3, // 自定义重试次数
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 10000,
  },
})
```

### 扩展功能

您可以通过添加新的工具来扩展功能：

```typescript
// 在 tools.ts 中添加新工具
server.tool(
  'check_specific_package',
  '检查特定包的详细信息',
  { packageName: z.string() },
  async ({ packageName }) => {
    // 实现特定包检查逻辑
  }
)
```

## 📊 示例输出

```json
[
  {
    "name": "lodash",
    "version": "<4.17.21",
    "severity": "high",
    "description": "Lodash 原型污染漏洞",
    "recommendation": "升级到 4.17.21 或更高版本",
    "fixAvailable": true,
    "fixedVersion": ">=4.17.21",
    "githubAdvisoryId": "GHSA-35jh-r3h4-6jhm",
    "updatedAt": "2021-02-15T00:00:00.000Z",
    "moreInfo": "https://github.com/advisories/GHSA-35jh-r3h4-6jhm"
  }
]
```

## 🤝 贡献指南

欢迎贡献！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支: `git checkout -b feature/your-feature`
3. 提交更改: `git commit -am 'Add some feature'`
4. 推送到分支: `git push origin feature/your-feature`
5. 提交 Pull Request

## 📄 许可证

本项目采用 ISC 许可证。

## 🆘 支持

如果您遇到问题或有疑问，请：

1. 查看 [Issues](../../issues) 页面
2. 创建新的 Issue
3. 查看项目文档

## 🔄 版本历史

- **1.0.0**: 初始版本
  - 基础 MCP 服务器功能
  - npm 依赖安全审计
  - Cursor 集成支持

---

**注意**: 该工具依赖于 npm 官方 API，请确保您的网络环境能够访问 npm registry。企业用户可能需要配置代理或使用内部 npm registry。
