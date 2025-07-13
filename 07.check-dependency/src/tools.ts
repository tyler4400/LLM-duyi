import { z } from "zod";
import { server } from "./server.js";
import { SecurityAuditHandler } from "./security.js";

const handler = new SecurityAuditHandler();


server.tool(
    "audit_it",
    "审计项目依赖",
    // {
    //   "dependencies": {
    //     "react": "^18.2.0",
    //     "axios": "^1.6.7",
    //     "lodash": "4.17.21"
    //   }
    // }
    {
        dependencies: z.record(z.string()).describe("dependencies对象")
    },
    // 工具要做的事情
    async ({dependencies})=>{
        const result = await handler.auditNodejsDependencies({dependencies})

        return {
            content: result.content.map(item=>({
                ...item,
                type: "text"
            }))
        }
    }
)