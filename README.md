# ManageBac 任务抓取助手

> **批量抓取 ManageBac 所有班级的任务和成绩数据，并导出为 CSV 文件。**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-orange.svg)

## ✨ 功能特性

- 🔍 **自动抓取班级列表**：一键获取当前账号下的所有班级
- 📊 **批量任务采集**：自动遍历所有班级，收集任务和成绩数据
- 📝 **详细成绩记录**：支持多项评估标准（A/B/C/D、学校成绩等）
- 🎯 **状态跟踪**：识别任务提交状态（已交/未交/逾期/未评估）
- 💾 **CSV 导出**：一键导出结构化数据，方便后续分析
- 🎨 **简洁界面**：三步操作流程，清晰的状态提示

## 📦 安装方法

### 方法一：开发者模式加载（推荐）

1. 下载本项目代码或 [下载 ZIP 包](https://github.com/Luckyji6/MBTask-Capture-Assistant/archive/refs/heads/main.zip)
2. 解压到本地文件夹
3. 打开 Chrome 浏览器，访问 `chrome://extensions/`
4. 开启右上角的 **"开发者模式"**
5. 点击 **"加载已解压的扩展程序"**
6. 选择项目中的 `extension` 文件夹
7. 扩展安装完成！浏览器工具栏会显示扩展图标

### 方法二：使用打包文件

1. 下载 `managebac-task-helper.zip`
2. 解压到本地
3. 按照方法一的步骤 3-6 加载

## 🚀 使用指南

### 步骤 1：刷新班级列表

1. 在 ManageBac 网站登录你的账号
2. 点击浏览器工具栏的扩展图标
3. 点击 **"刷新班级"** 按钮
4. 等待提示 "✅ 已获取 X 个班级"

> ⚠️ 如果提示连接错误，请刷新 ManageBac 页面后重试

### 步骤 2：批量抓取任务

1. 完成步骤 1 后，**"批量抓取任务"** 按钮会自动启用
2. 点击按钮开始批量抓取
3. 页面会自动跳转到各个班级的任务页面
4. **重要提示**：抓取过程中页面会自动刷新，如果停止刷新，请打开扩展查看进度

### 步骤 3：保存抓取结果

1. 批量抓取完成后，**"保存 CSV"** 按钮会自动启用
2. 点击按钮即可下载 CSV 文件
3. CSV 文件包含以下信息：
   - 班级名称和链接
   - 任务序号、名称、截止日期
   - 任务状态（进行中/已完成等）
   - 各项评估标准成绩（A/B/C/D/学校成绩）
   - 提交情况（已交/未交/逾期）
   - 任务链接

## 📊 CSV 数据格式

| 列名 | 说明 |
|------|------|
| 班级 | 班级名称 |
| 班级链接 | 班级主页 URL |
| 任务序号 | 该班级内的任务编号 |
| 任务名称 | 作业/任务的标题 |
| 截止日期 | 提交截止时间 |
| 状态 | 任务进度状态 |
| A/B/C/D | 各项评估标准的得分 |
| 学校成绩 | 学校总评成绩 |
| 提交情况 | 提交状态说明 |
| 其他评估细则 | 其他非标准评估项 |
| 任务链接 | 任务详情页 URL |

## 🔒 隐私与安全

- ✅ **本地运行**：所有数据处理完全在您的浏览器本地进行
- ✅ **无数据上传**：不会向任何外部服务器发送您的账号或成绩信息
- ✅ **仅限 ManageBac**：扩展仅在 `*.managebac.cn` 域名下运行
- ✅ **开源透明**：所有代码公开可查，欢迎审计

### 权限说明

| 权限 | 用途 |
|------|------|
| `storage` | 缓存班级列表和抓取数据 |
| `tabs` | 获取当前标签页信息 |
| `scripting` | 注入脚本以抓取页面数据 |
| `downloads` | 导出 CSV 文件到本地 |
| `host_permissions` | 仅限访问 ManageBac 网站 |

## 🛠️ 技术架构

- **Manifest V3**：Chrome 最新扩展规范
- **Content Script**：DOM 解析和数据提取
- **Service Worker**：后台数据管理和状态同步
- **Storage API**：持久化缓存
- **Downloads API**：文件导出

## ❓ 常见问题

<details>
<summary><strong>Q: 提示 "Could not establish connection" 怎么办？</strong></summary>

**A**: 这通常是因为页面还没加载完成。请刷新 ManageBac 页面后重试步骤 1。
</details>

<details>
<summary><strong>Q: 批量抓取卡住不动了？</strong></summary>

**A**: 打开扩展弹窗查看进度状态。如果确实卡住，可以刷新页面后重新点击"批量抓取任务"。
</details>

<details>
<summary><strong>Q: 导出的 CSV 乱码怎么办？</strong></summary>

**A**: 使用 Excel 打开时，请选择"数据" → "从文本/CSV"，并选择 UTF-8 编码。
</details>

<details>
<summary><strong>Q: 可以抓取其他人的成绩吗？</strong></summary>

**A**: 不可以。扩展只能访问当前登录账号有权限查看的数据。
</details>

<details>
<summary><strong>Q: 扩展会被 ManageBac 检测到吗？</strong></summary>

**A**: 扩展使用正常的浏览器 API 读取页面内容，与手动复制粘贴数据无异。但请遵守学校的网络使用政策。
</details>

## ⚠️ 免责声明

**重要提示：使用本扩展前请仔细阅读以下免责声明**

1. **教育用途**：本扩展仅供学生管理个人学习任务和成绩使用，不得用于任何违反学校规定或 ManageBac 服务条款的行为。

2. **数据安全**：
   - 本扩展不会主动上传或泄露您的个人数据
   - 所有数据处理均在本地浏览器完成
   - 但请妥善保管导出的 CSV 文件，避免泄露个人成绩信息

3. **使用风险**：
   - 使用本扩展的一切后果由用户自行承担
   - 开发者不对因使用本扩展导致的任何直接或间接损失负责
   - 包括但不限于：数据丢失、账号异常、违反学校规定等

4. **合规性**：
   - 请确保您的使用行为符合所在学校的网络使用政策
   - 请确保您有权访问和导出相关数据
   - 如有疑问，请咨询学校管理员

5. **服务变更**：
   - ManageBac 网站更新可能导致扩展功能失效
   - 开发者不保证扩展持续可用性
   - 本项目按 "AS IS" 方式提供，不提供任何明示或暗示的保证

6. **第三方服务**：
   - 本扩展与 ManageBac 官方无任何关联
   - ManageBac 是 Faria Education Group 的注册商标

**使用本扩展即表示您已阅读、理解并同意上述所有条款。**

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 开源协议。

```
MIT License

Copyright (c) 2025 Lucky ji

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

- 报告 Bug：[提交 Issue](https://github.com/Luckyji6/MBTask-Capture-Assistant/issues)
- 功能建议：[提交 Issue](https://github.com/Luckyji6/MBTask-Capture-Assistant/issues)
- 代码贡献：Fork 项目后提交 PR

## 📮 联系方式

如有问题或建议，请通过 [GitHub Issues](https://github.com/Luckyji6/MBTask-Capture-Assistant/issues) 联系。

## 🌟 Star History

如果这个项目对你有帮助，请给个 Star ⭐️

---

**⚡️ 让 ManageBac 任务管理更高效！**

