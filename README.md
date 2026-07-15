# Usagi Desk Sync

使用 Tauri 2、React 和 TypeScript 实现的 Windows 半身桌宠。默认角色为原创同人风格的乌萨奇桌宠，坐在键盘和鼠标前同步全局输入。

## 功能

- 透明、无边框、始终置顶的桌宠窗口
- 按住桌宠可拖动窗口
- 点击穿透和始终置顶切换
- Rust Win32 全局键盘和鼠标钩子
- `idle`、`type_left`、`type_right`、`click`、`sleep`、`error`、`success` 状态机
- QWERTY 按键高亮、左右手打字动作和鼠标按键高亮
- 眼睛跟随全局鼠标位置
- 轻微呼吸，以及鼠标左键长按蓄力压扁和临界回弹
- 桌宠上按住 `Ctrl` 滚动鼠标滚轮，可在 50% 到 200% 间缩放
- `Ctrl + +`、`Ctrl + -` 调整大小，`Ctrl + 0` 恢复 100%
- 托盘菜单：显示/隐藏、置顶、点击穿透、固定缩放档位、退出
- PNG 序列帧资源包：`public/assets/pets/usagi-desk`

按普通字母键会触发左右手打字，`Enter` 触发成功状态，`Esc` 触发错误状态。约 12 秒没有输入后进入睡眠。缩放比例会自动保存，下次启动继续使用。

## 首次运行

```powershell
npm install
npm run generate:assets
npm test
npm run build
npm run lint
npm run tauri:dev
```

如果 Windows 没有安装 Visual Studio C++ Build Tools，可以使用项目附带的 GNU/MinGW 启动脚本：

```powershell
npm run tauri:dev:gnu
```

只查看 React 页面：

```powershell
npm run dev
```

## 构建安装包

```powershell
npm run tauri:build
```

使用 GNU/MinGW 工具链构建：

```powershell
npm run tauri:build:gnu
```
