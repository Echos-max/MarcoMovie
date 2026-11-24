# CineBox Spider API

本目录保留现有 Node.js API，并通过独立的 `tvbox-spider-server` 兼容服务执行 CatVod DEX Spider。Expo 客户端不直接加载 DEX；Node 服务负责导入配置、挑选试运行源，并把 Spider HTTP 请求转发给兼容服务。

## 当前接入范围

第一阶段只启用配置中已确认存在对应 DEX 类的三个源：

- `厂长` → `csp_Czsapp`
- `荐片` → `csp_Jianpian`
- `csp_Dm84` → `csp_Dm84`

名单可通过环境变量 `CATVOD_SITE_KEYS` 调整。源是否真正可用，仍需在运行时逐一验证；DEX 中存在类名不等于站点网络请求一定成功。

## 服务结构

- Expo 客户端：继续使用现有 UI，不直接执行 Spider。
- Node API：默认 `http://电脑局域网IP:8787`。
- CatVod 兼容服务：默认 `http://127.0.0.1:9978`，只建议在本机开发网络运行。

Node 启动或导入配置时，会把选中的站点写入兼容服务，并将项目已有的 `spiders/feimao-spider.dex.jar` 作为每个站点的本地 `jar`。该本地文件的 MD5 与肥猫配置顶层 `spider` 字段的 MD5 一致，因此无需再次下载伪装成图片地址的 JAR。

## Windows 首次准备

要求完整 JDK 21 或更高版本、Node.js 20 或更高版本。先在 PowerShell 检查：

```powershell
java -version
javac -version
```

然后在 `server` 目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-catvod-runtime.ps1
```

脚本会下载第三方 `tvbox-spider-server` 源码和 Maven 依赖，并使用本机 JDK 编译。该第三方项目 README 目前明确记录的实测环境是 macOS Apple Silicon + JDK 21；Windows 编译和运行尚不能视为已被上游验证。这里提供的是 Windows PowerShell 构建路径，必须以本机编译和自检结果为准。

## 启动顺序

**PowerShell 窗口 1：** 在 `server` 目录启动 CatVod 兼容服务，并保持窗口打开：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-catvod-runtime.ps1
```

先确认浏览器能打开：

```text
http://127.0.0.1:9978/health
```

**PowerShell 窗口 2：** 在 `server` 目录启动现有 Node 服务：

```powershell
npm start
```

Node 服务仍监听 `8787`。iPhone 与电脑保持同一 Wi-Fi，现有 `.env` 的 `EXPO_PUBLIC_API_BASE_URL` 无需因为这次改动而更换。

## 新增 / 转发 API

- `GET /api/spider/status`：检查兼容服务连接状态和配置同步状态。
- `GET /api/spider/:siteKey?do=home&filter=1`：获取首页分类与推荐列表。
- `GET /api/spider/:siteKey?do=category&tid=...&pg=1&filter=1&extend=%7B%7D`：获取分类列表。
- `GET /api/spider/:siteKey?do=detail&ids=...`：获取影视详情和播放线路。
- `GET /api/spider/:siteKey?do=search&key=...&quick=0&pg=1`：搜索。
- `GET /api/spider/:siteKey?do=player&flag=...&id=...`：解析选中的播放线路。

`src/services/marcoApi.ts` 已增加对应的 TypeScript 调用方法；本次没有修改任何页面 UI。下一步才会把真实 API 数据接到现有首页、详情页和播放器页面。

## 安全提醒

CatVod DEX Spider 是第三方可执行代码。运行兼容服务会在电脑 JVM 进程中执行它，不应把该服务端口直接暴露到公网，也不要加载来源不可信的 DEX/JAR。正式部署前还需要增加鉴权、HTTPS、访问限制和运行隔离。
