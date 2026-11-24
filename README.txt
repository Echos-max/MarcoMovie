MarcoMovie2 订阅联动影视源功能实现补丁

适用基线：MarcoMovie-影视源错误提示修复版.zip（Expo/React Native + Node API 8787 + CatVod Runtime 9978）

覆盖 5 个源码文件：
1. server/src/index.js
2. server/src/subscriptionStore.js
3. src/services/marcoApi.ts
4. src/app/(tabs)/library.tsx
5. src/app/search/[id].tsx

实现内容：
- Node API 首次启动时，若订阅管理中不存在同名订阅，则从现有 Runtime 源池配置创建“无尽资源”本地订阅，并从当前 active-config 创建“厂长影视”本地订阅；迁移幂等，不重复创建。
- 两个订阅均可在订阅管理页面正常启用/停用；停用后不再贡献影视源、分类、筛选和搜索结果。
- 无尽资源映射到现有 Runtime 源池 cms_wujin；厂长影视映射到 active-config 中已有的“厂长” Spider key。
- 影视源页面读取全部已启用订阅，左上角显示启用的订阅名称；分类与筛选选项跨订阅合并。
- 新增“全部”分类作为默认状态；未选分类和筛选时对所有启用影视站点请求空分类 ID，合并展示各源默认影视列表；遇到不支持空分类 ID 的 Spider，会回退读取首页影片列表。选择分类或筛选后加载对应数据。
- CMS 分类优先使用源站真实 class/type_id，避免把展示分组 ID 当成源站分类 ID。
- 搜索页只显示启用订阅中的视频站点，并使用真实 Runtime key；详情页继续使用来源 key，保持原有详情和播放链路。

数据处理：
- 补丁不覆盖 subscriptions.json 或订阅快照文件。
- Node API 首次启动时会向现有订阅存储新增缺失的“无尽资源”和“厂长影视”两条本地订阅及其快照；原有订阅及其启停状态保留。
- 不修改 active-config.json、feimao.config.json、CatVod sources.json、影视库缓存或播放记录。

验证：
- Node 两个修改文件通过 node --check。
- 三个 TypeScript/TSX 文件通过 TypeScript 语法解析。
- 当前打包环境没有项目 node_modules，无法在此环境完成完整 tsc --noEmit；需要在用户本机安装依赖的项目目录运行类型检查。
- 尚未连接用户本机正在运行的 8787/9978 服务，因此真实站点请求、详情和播放需要在本机做最终联调。

应用方式：将压缩包解压到项目根目录并覆盖同名 5 个源码文件，保留本地 server/data 目录不变；然后重启 Node API（8787）并重新加载 Expo 前端。Java Runtime 不需要因本补丁单独重启。
