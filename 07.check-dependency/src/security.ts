// 这个是核心文件
import type { NpmDependencies, Vulnerability } from "./types.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import npmFetch from "npm-registry-fetch";

/**
 * 将一个错误转为 MCP 错误
 * @param error 
 * @param context 
 * @param code 
 */
function toMcpError(
  error?: unknown,
  context?: string,
  code: ErrorCode = ErrorCode.InternalError
): McpError {
    // 构建错误的信息
    const message = context
    ? `${context} : ${ error instanceof Error ? error.message : "未知错误"}` 
    : error instanceof Error
    ? error.message
    : "未知错误"
    return new McpError(code, message, {original: error})
}

/**
 * 校验包名是否合格
 * @param name 
 * @returns 
 */
function isValidPackageName(name: string): boolean {
    const packageNameRegex =
      /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
    return packageNameRegex.test(name);
  }

function extractActualDependencies(
    deps: Record<string, any>
  ): Record<string, string> {
    const maybeNested = deps.dependencies;
    if (
      maybeNested &&
      typeof maybeNested === "object" &&
      Object.keys(maybeNested).length > 0
    ) {
      return maybeNested;
    }
    return deps;
  }

/**
 * 做依赖审计的类
 */
export class SecurityAuditHandler {
  /**
   * 审计单个依赖包
   * @param name 依赖包的名称 "axios"
   * @param version 依赖包的版本 "^1.3.0"
   */
  private async auditSingleDependency(
    name: string,
    version: string
  ): Promise<any> {
    try {
        // 1. 校验包名和版本号
        if(
            !name ||
            !version ||
            typeof name !== "string" ||
            typeof version !== "string"
        )
        throw new Error(`无效的包名或者版本号：${name}@${version}`);

        // 2. 校验包名的格式（通过正则表达式去校验）
        if(!isValidPackageName(name)){
            throw new Error(`包名格式无效:${name}`);
        }

        // 3. 目前我们校验的是 package.json 里面的包
        // 实际上在企业开发中：校验 package-lock.json 里面的包
        // 去除前缀
        const cleanVersion = version.trim().replace(/^[\^~]/, "");

        // 4. 构造一个用于模拟项目依赖关系的请求体
        // 审计的时候，审计的是一个项目
        const auditData = {
            name: "example", // 项目的名字随便取
            version: "1.0.0", // 版本号也随便
            // 项目的顶层依赖
            // 相当于项目里面的 dependencies
            requires: { [name]: cleanVersion }, 
            // 实际安装的依赖的版本，相当于 package-lock.json 里面记录的依赖的版本
            dependencies: {
                [name]: { version: cleanVersion }
            }
        }

        // 5. 调用 npm 官方接口进行审计
        const result = await npmFetch.json("/-/npm/v1/security/audits",{
            method:"POST",
            body: auditData,
            gzip: true,
            timeout: 30000,
            retry: {
                retries: 2,
                factor: 2,
                minTimeout: 1000,
                maxTimeout: 5000
            }
        })

        if(!result)
            throw new Error(`审计 ${name}@${cleanVersion} 无响应`);

        return result;
    } catch (error) {
      // 审计出错的时候
      console.error(`[错误]审计 ${name}@${version} 报错：`, error);
      // 这里可以抛出一个 MCP Error
      throw toMcpError(error, `审计 ${name}@${version} 这个依赖失败☹️`);
    }
  }

  /**
   * 批量审计多个依赖
   * 核心就是调用 auditSingleDependency
   */
  async auditNodejsDependencies(args: { dependencies: NpmDependencies }) {
    try{
        // 1. 校验参数是否合法
        if(!args || typeof args.dependencies !== "object")
            throw new Error("审计的依赖的参数不合法");

        // 2. 提取依赖列表
        const actualDeps = extractActualDependencies(args.dependencies);

        // 3. 验证依赖对象是否有效
        if (
            !actualDeps ||
            typeof actualDeps !== "object" ||
            Object.keys(actualDeps).length === 0
          ) {
            console.error("[WARN] 未发现要审核的有效依赖项");
            // 这里返回的对象格式是符合 MCP 协议的响应格式
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify([], null, 2),
                },
              ],
            };
          }

        // 4. 初始化结果数组
        const auditResults = [];
        // 转换成一个二维数组
        // [["axios", "1.4.7"], ["lodash", "2.3.4"]]
        const dependencyEntries = Object.entries(actualDeps);
        const totalDependencies = dependencyEntries.length; // 总共要审计多少个依赖

        // 5. 开始进行审计
        let processedCount = 0; // 记录当前审计了多少个依赖了
        // 遍历了每一个依赖项，并且进行审计
        for(const [name, version] of dependencyEntries){
            processedCount++;

            try{
                const result = await this.auditSingleDependency(name, version);
                if(result){
                    auditResults.push(result);
                }
            }catch(error){
                console.error("审计失败", error);
            }

            if(processedCount < totalDependencies){
                // 说明还没有审计完
                // 因为我们目前这个案例没有做分页或者分批
                await new Promise(resovle=> setTimeout(resovle, 100));
            }
        }
        // 所有依赖的审计结果都放在了 auditResults 这个数组里面

        // 6. 对审计的结果稍微做一下处理
        const mergedResult = auditResults.flatMap(result=>this.processVulnerabilities(result))

        // 7. 返回结果
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(mergedResult, null, 2)
                }
            ]
        }


    }catch(error){
        console.error("[ERROR] 审计失败☹️:", error);
        if (error instanceof McpError) throw error; // 如果已经是 MCP 错误，就直接抛出
        throw toMcpError(error, `审计失败☹️`);
    }
  }

  /**
   * 处理 audit 结果，提取出规范化的漏洞数组
   * @param auditData - npm registry 的原始返回结果
   * @returns Vulnerability[] - 格式化后的漏洞列表
   */
  private processVulnerabilities(auditData: any): Vulnerability[] {
    try {
      // 基本数据验证
      if (!auditData || typeof auditData !== "object") {
        console.error("[WARN] Invalid audit data received");
        return [];
      }

      if (
        !auditData.advisories ||
        typeof auditData.advisories !== "object" ||
        Object.keys(auditData.advisories).length === 0
      ) {
        return []; // 如果没有漏洞数据，直接返回空数组
      }

      // 从返回的数据里面去获取漏洞信息
      const advisories = auditData.advisories;

      // 然后做一个格式的标准化
      return Object.values(advisories)
        .filter((advisory: any) => advisory && typeof advisory === "object") // ✅ 过滤无效数据
        .map((advisory: any) => ({
          name: advisory.module_name || "unknown", // 漏洞对应的包名，例如 "lodash"
          version: advisory.vulnerable_versions || "unknown", // 受影响的版本范围，例如 "<4.17.21"
          severity: advisory.severity || "low", // 漏洞严重等级，如 "high"
          description: advisory.overview || "No description available", // 漏洞描述
          recommendation:
            advisory.recommendation || "No recommendation available", // 官方修复建议
          fixAvailable: !!advisory.patched_versions, // 是否存在已修复版本
          fixedVersion: advisory.patched_versions || null, // 已修复的版本范围，例如 ">=4.17.21"
          githubAdvisoryId: advisory.github_advisory_id || null, // GitHub 漏洞数据库中的编号
          updatedAt: advisory.updated || null, // 漏洞最后更新时间
          moreInfo: advisory.url || null, // 查看更多详情的链接
        }));
    } catch (error) {
      console.error("[ERROR] Failed to process vulnerabilities:", error);
      return [];
    }
  }
}
