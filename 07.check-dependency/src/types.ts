/**
 * 漏洞的等级
 * critical - 严重
 * high - 高危
 * moderate - 中等
 * low - 低危
 */
export type severityLevel = "critical" | "high" | "moderate" | "low";

/**
 * 漏洞的信息结构
 */
export interface Vulnerability {
    name: string; // 漏洞所在的包名
    version: string; // 漏洞所在包的版本号
    severity: severityLevel; // 漏洞等级
    description: string; // 漏洞描述
    recommendation: string; // 官方推荐的修复方案
    fixAvailable: boolean; // 是否存在修复版本
    fixedVersion?: string; // 修复了该漏洞的版本
    githubAdvisoryId?: string; 
    updatedAt?: string; // 漏洞信息最后一次更新的时间
    cvss?: {
        score: number; // 分数
        vector: string; // 向量字符串
    };
    cwe?: string[]; // 编号列表
    url?:string; // 漏洞详细说明的链接
}

/**
 * 依赖包的结构
 * 键 -> 包名，值 -> 版本号
 * {
 *    "axios": "^1.3.0",
 *    "lodash": "~4.17.20"
 * }
 */
export interface NpmDependencies{
    [key: string]: string
}