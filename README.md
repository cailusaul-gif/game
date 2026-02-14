# 双人冒险游戏框架（原型）

这是一个可直接运行的 90 度俯视双人冒险框架，已包含你提出的核心机制：

- 一个关卡由若干地图组成（最后一个是 Boss 地图）
- 每张普通地图随机生成敌人
- 击杀最后地图 Boss 才能通关
- 3 个职业：武士 / 弓箭手 / 魔法师
- 翻滚有无敌帧
- 装备系统：武器、衣服、鞋子、饰品

## 运行方式

直接用浏览器打开 `index.html` 即可。

## 部署到云端 Web（推荐）

这是纯前端静态项目，可直接托管到静态平台。

### 方案0：GitHub Pages（你当前最适合）

项目已包含自动部署工作流：`.github/workflows/deploy-pages.yml`。

1. 把项目推送到 GitHub 仓库（分支 `main` 或 `master`）
2. 到仓库 `Settings -> Pages`，`Build and deployment` 选择 `GitHub Actions`
3. 推送后会自动触发 `Deploy To GitHub Pages` 工作流
4. 部署成功后，访问：
   - `https://<你的GitHub用户名>.github.io/<仓库名>/`

### 方案1：Vercel

1. 把项目推到 GitHub
2. 在 Vercel 里 `Add New Project` 选择这个仓库
3. 保持默认（无需 Build Command，Root 为仓库根目录）并部署

本项目已包含 `vercel.json`，可直接生效。

### 方案2：Netlify

1. 把项目推到 GitHub
2. 在 Netlify 里 `Add new site` 选择仓库
3. Build command 留空，Publish directory 填 `.`

本项目已包含 `netlify.toml`，可直接生效。

### 方案3：Cloudflare Pages

1. 把项目推到 GitHub
2. 在 Cloudflare Pages 里创建项目并连接仓库
3. Framework preset 选 `None`，Build command 留空，Output directory 填 `.`

本项目已包含 `_headers`，Cloudflare Pages 会自动读取缓存头设置。

## 封装为 Windows 可执行程序（给朋友分发）

你可以把游戏打包为 Windows 下可直接运行的单文件 `exe`（便携版）。

### 环境要求

- Windows 10/11
- Node.js 20+

### 打包步骤（Windows）

1. 双击运行 `build-windows.bat`
2. 等待完成后，在 `dist/` 目录拿到：
   - `CoopAdventure-1.0.0-x64.exe`
3. 把这个 `exe` 发给朋友即可运行（无需安装 Node）

### 一键绿色版（推荐）

1. 双击运行 `build-green-windows.bat`
2. 等待完成后，在 `green-release/` 目录拿到：
   - `双人冒险-绿色版-x64.exe`（推荐）
   - `双人冒险-绿色版-arm64.exe`（Windows ARM）
3. 这个文件就是免安装绿色版，直接双击游玩

### 手动命令（可选）

```bash
npm install
npm run dist:win
```

## 控制说明

- 职业选择界面
  - P1：`Q` 武士 / `W` 弓箭手 / `E` 魔法师
  - P2：`U` 武士 / `I` 弓箭手 / `O` 魔法师
  - `Enter` 开始
- 游戏中
  - P1：`WASD` 移动，`F` 攻击，`G` 翻滚（无敌帧），`R` 技能，`T` 药水
  - P2：`IJKL` 移动，`H` 攻击，`Y` 翻滚（无敌帧），`P` 技能，`[` 药水

## 当前代码结构（已模块化）

- `index.html`：页面入口与脚本加载顺序
- `desktop/main.cjs`：Electron 桌面壳入口（用于封装 Windows 可执行）
- `src/styles.css`：UI 与画布样式
- `src/config/constants.js`：常量配置（职业、敌人、输入、地图尺寸）
- `src/core/`：基础能力（输入、工具函数）
- `src/systems/`：系统层（装备、瓦片地图、碰撞）
- `src/entities/`：实体层（玩家、敌人、Boss、投射物、掉落）
- `src/ui/`：渲染与 HUD
- `src/game.js`：主循环与关卡流转
- `src/main.js`：启动入口

## 已接入机制

- `entities/systems/ui` 模块化拆分
- 瓦片地图（Tile Map）房间生成
- 地图障碍（墙体）碰撞
- 玩家/敌人/投射物与障碍交互
- 面板系统：装备面板、属性面板、技能面板
- 常见RPG内容：等级经验、金币、药水、暴击、吸血、减伤、装备品质
- 已套用角色美术（`role.zip`）：武士=Forest_Ranger_3，弓箭手=Forest_Ranger_1，魔法师=Forest_Ranger_2
- 已套用敌人美术（`enemy.zip`）：小怪=Goblin，投弹怪=Orc，重甲/Boss=Ogre
- 新增风格化地图：森林营地、沼泽荒地、石砌遗迹、Boss堡垒（含装饰物）

## 下一步建议

- 增加“地图间随机词缀”（例如：毒雾、狂暴、减速地形）
- 加入道具主动技能（冷却与资源系统）
- 把敌人 AI 拆成行为状态机（巡逻/追击/撤退）
- 增加本地存档（关卡进度、装备池）
