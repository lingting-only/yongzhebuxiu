# 勇者不休 · 像素挂机远征

> 挂机永不休息,远征永不停步。

竖屏手机优先的 H5 挂机 ARPG。纯前端(原生 HTML/CSS/JS),无构建、无后端、零外部素材(美术全部由代码绘制的像素精灵)。

## 玩法(闯关无限推进)

- **每关击杀达标 → Boss 降临 → 击败 Boss 通关**,无限推进,死亡原地复活、关卡进度保留
- **5 张主题地图循环**:翠风草原 → 霜语雪原 → 流金沙漠 → 燃火之地 → 幽暗深渊(地面/围墙/树木随主题变色)
- **5 个主题 Boss**:史莱姆之王/冰霜蝠王/蘑菇沙皇/骷髅领主/暗影魔龙,带冲锋/环形弹幕/召唤随从技能,顶部大血条
- **精英怪**:金环+皇冠,血厚攻高,必掉宝箱
- **随机事件**:宝箱雨 / 金币雨 / 怪物狂暴 / 怪物狂潮
- **挑战词条**:第 2 关起每关随机 1 条(第 5 关起可能 2 条),如"迅捷:怪速+25% 金币+50%"
- 按住屏幕拖动移动(电脑 WASD);7 种武器**同时自动攻击**,特效随武器等级逐档变炫
  (铁剑/魔导弹/旋风斧/闪电链/火球术/飞刀阵/回旋镖)
- 拾取宝箱 → 弹窗三选一(属性点/新武器/技能);金币全军强化、材料防具强化
- 技能:暴击/吸血/贪婪/再生/磁力/守护/荆棘 + 自动施放的陨石术/狂暴
- 站桩越久怪物越快(围猎机制);打开宝箱/工坊/帮助时自动暂停
- 进度自动保存在浏览器 localStorage(支持旧版存档迁移)

## 本地运行

直接双击 `index.html` 即可(无需服务器)。

或起一个静态服务:

```bash
python -m http.server 8080
# 手机与电脑同一 WiFi,访问 http://<电脑局域网IP>:8080
```

## PWA(安装到主屏幕 / 离线游玩)

部署到 HTTPS(Vercel)后:

- **手机**:浏览器打开 → 菜单"添加到主屏幕" → 独立 App 图标、全屏无浏览器栏
- **离线**:首次加载后断网也能打开游玩(Service Worker 缓存全部资源)
- 发布新版本时:改 `index.html` 里的 `?v=` 版本号 + `sw.js` 里的 `CACHE` 版本号

## 部署到 Vercel(纯静态,零配置)

方式一 · 网页拖拽(最快):
1. 打开 https://vercel.com/new
2. 把整个项目文件夹拖入页面,点 Deploy 即可

方式二 · GitHub 导入:
1. 把本项目推到 GitHub 仓库
2. Vercel → Add New Project → 导入该仓库 → 直接点 Deploy(Framework Preset 选 Other,无需 Build Command)

方式三 · CLI:
```bash
npm i -g vercel
vercel          # 预览
vercel --prod   # 生产
```

## 修改参数

所有数值集中在 **`js/config.js`**(带 ★ 注释):

| 想改什么 | 位置 |
|---|---|
| 怪物血量/攻击/速度/掉落 | `MONSTER_TYPES` |
| Boss 数值与技能 | `BOSSES` |
| 地图主题与配色 | `THEMES` |
| 挑战词条 | `STAGE_MODS` |
| 随机事件 | `EVENTS` / `CONFIG.events` |
| 每关击杀目标 | `stageQuota()` |
| 武器伤害/攻速/射程/弹数 | `WEAPONS` |
| 技能效果与上限 | `SKILLS` |
| 宝箱掉率与保底 | `CONFIG.chest` |
| 站桩围猎(站越久怪越快) | `CONFIG.idleHunt` |
| 节奏(刷怪间隔/移速/暴击等) | `CONFIG.player`、`CONFIG.spawnInterval` |
| 强化消耗 | `CONFIG.upgrade` |
| 同屏怪物上限(性能) | `CONFIG.maxMonsters` |

## 目录结构

```
index.html       入口(界面骨架 + 按依赖顺序加载 js)
css/style.css    全部样式(HUD/面板/宝箱弹窗)
js/config.js     ★ 所有可调参数(怪物/武器/技能/宝箱)
js/utils.js      工具函数
js/sprites.js    像素精灵(字符画 → 离屏 canvas)
js/audio.js      WebAudio 合成音效
js/world.js      画布/相机/地面/围墙/装饰
js/entities.js   玩家/怪物实体与更新、伤害结算
js/weapons.js    ★ 多武器同时自动攻击系统
js/loot.js       掉落与磁吸拾取
js/levelup.js    ★ 宝箱三选一弹窗
js/shop.js       强化工坊
js/ui.js         HUD 刷新与按钮
js/input.js      触屏摇杆 + 键盘
js/main.js       主循环/渲染/存档
```
