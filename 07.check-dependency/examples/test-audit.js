/**
 * Check Dependency MCP Tool 测试示例
 *
 * 该脚本展示了如何在本地测试 MCP 依赖审计工具
 * 运行前请确保已经构建了项目: npm run build
 */

const { spawn } = require('child_process')
const path = require('path')

// 测试用的依赖数据
const testDependencies = {
  react: '^18.2.0',
  axios: '^1.6.7',
  lodash: '4.17.20', // 已知有漏洞的版本
  express: '^4.18.2',
  typescript: '^5.8.3',
}

// 创建测试用的 MCP 调用
const mcpCall = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'audit_it',
    arguments: {
      dependencies: testDependencies,
    },
  },
}

console.log('🚀 启动 Check Dependency MCP 工具测试')
console.log('📦 测试依赖列表:')
console.log(JSON.stringify(testDependencies, null, 2))
console.log('\n⏳ 开始审计...\n')

// 启动 MCP 服务器进程
const mcpServer = spawn('node', [path.join(__dirname, '../build/index.js')], {
  stdio: ['pipe', 'pipe', 'pipe'],
})

// 处理服务器输出
mcpServer.stdout.on('data', (data) => {
  console.log('📊 MCP 服务器输出:', data.toString())
})

mcpServer.stderr.on('data', (data) => {
  const message = data.toString()
  if (message.includes('审计依赖服务器已经启动')) {
    console.log('✅ MCP 服务器已启动')

    // 发送测试调用
    mcpServer.stdin.write(JSON.stringify(mcpCall) + '\n')
  } else {
    console.log('ℹ️  服务器消息:', message)
  }
})

mcpServer.on('close', (code) => {
  console.log(`\n🏁 MCP 服务器进程结束，退出码: ${code}`)
})

// 处理进程退出
process.on('SIGINT', () => {
  console.log('\n🛑 收到中断信号，正在关闭服务器...')
  mcpServer.kill()
  process.exit(0)
})

// 设置超时，避免进程无限等待
setTimeout(() => {
  console.log('\n⏰ 测试超时，正在关闭服务器...')
  mcpServer.kill()
  process.exit(1)
}, 60000) // 60秒超时
