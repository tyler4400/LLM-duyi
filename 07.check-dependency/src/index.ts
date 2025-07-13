import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from "./server.js";
import "./tools.js"

async function main(){
    const trans = new StdioServerTransport(); // 创建传输通道（流的方式进行通信）
    await server.connect(trans);
    console.error("审计依赖服务器已经启动...");
}
main();