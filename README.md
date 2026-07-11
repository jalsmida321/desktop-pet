# Mochi Cat

一个使用 Tauri 2、React 和 TypeScript 实现的 Windows 桌宠 MVP。

## 功能

- 透明、无边框、始终置顶窗口
- 鼠标按住猫咪拖动窗口
- Rust Win32 全局键盘和鼠标监听
- `idle`、`type_left`、`type_right`、`click`、`sleep`、`error`、`success` 状态机
- `public/assets/pets/default-cat/pet.json` 驱动的 PNG 序列帧资源包，运行时路径为 `/assets/pets/default-cat`
- 托盘菜单控制显示/隐藏、置顶、点击穿透和退出

按键时猫咪会左右拍爪，Enter 触发成功状态，Esc 触发错误状态，15 秒无输入后睡眠。双击猫咪或任意全局鼠标按下会触发点击状态。

## 开发运行

Windows 需要 Rust stable、Microsoft Visual Studio 2022 Build Tools 的 C++ 桌面工作负载，以及 WebView2 Runtime。

```powershell
npm install
npm run generate:assets
npm run tauri:dev
```

当前机器也已配置免管理员的 GNU Rust/MinGW 备用工具链，可在新终端直接运行：

```powershell
npm run tauri:dev:gnu
```

只查看 React 页面：

```powershell
npm run dev
```

生产构建：

```powershell
npm run tauri:build
```

使用当前机器的 GNU 备用工具链构建：

```powershell
npm run tauri:build:gnu
```
