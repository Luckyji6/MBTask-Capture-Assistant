# ManageBac 任务抓取助手

> **一键抓取 ManageBac 班级任务与成绩数据，自动计算 GPA，并在网页内直接下载 CSV 汇总。**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-orange.svg)

## ✨ 功能特性

- 🔍 **一键启动**：点击一次按钮，自动刷新班级并开始批量抓取
- 📊 **批量任务采集**：自动遍历所有班级，收集任务与评估数据
- 🧮 **自动 GPA 计算**：按 A/B/C/D 平均分计算科目平均，并汇总总 GPA
- 🖥️ **网页内结果展示**：抓取完成后直接在页面遮罩层查看 GPA、任务统计和下载入口
- 💾 **CSV 汇总导出**：可直接在网页中下载成绩汇总 CSV
- 🎯 **状态跟踪**：支持抓取进度显示与任务数量统计

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

### 一键抓取流程

1. 在 ManageBac 网站登录你的账号，并进入可看到班级菜单的页面
2. 点击浏览器工具栏中的扩展图标
3. 点击唯一按钮 **"一键开始抓取"**
4. 如果本地没有班级缓存，扩展会先自动刷新班级列表
5. 获取到班级后，扩展会自动开始批量抓取任务与成绩
6. 抓取过程中网页会自动跳转，请保持当前标签页处于可运行状态
7. 抓取完成后，网页遮罩层会直接显示：
   - 各班级 A / B / C / D 平均分
   - 各班级科目平均分
   - 总 GPA
   - 统计任务数量
   - CSV 下载链接

> ⚠️ 如果提示连接错误或未获取到班级，请刷新 ManageBac 页面后重新点击“一键开始抓取”

## 📊 CSV 数据格式

| 列名 | 说明 |
|------|------|
| 班级 | 班级名称 |
| 班级链接 | 班级主页 URL |
| 任务数量 | 该班级本次统计到的任务数 |
| A 平均 | 该班级 A 项评分平均值 |
| B 平均 | 该班级 B 项评分平均值 |
| C 平均 | 该班级 C 项评分平均值 |
| D 平均 | 该班级 D 项评分平均值 |
| 科目平均 | 该班级 A/B/C/D 平均后的科目成绩 |

CSV 末尾还会额外附带一行总计信息，用于展示总任务数与总 GPA。

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

**A**: 这通常是因为页面还没加载完成，或者当前标签页不是有效的 ManageBac 页面。请刷新页面后重新点击“一键开始抓取”。
</details>

<details>
<summary><strong>Q: 批量抓取卡住不动了？</strong></summary>

**A**: 抓取过程中请尽量保持当前页面处于前台并避免频繁手动跳转。如果确实卡住，可刷新页面后重新点击“一键开始抓取”。
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

使用本扩展即表示您已阅读并同意以下条款：

1. **非官方工具**：本项目为第三方开源工具，与 ManageBac 及其所属公司无隶属、授权或官方合作关系。  
2. **用途限制**：本扩展仅用于个人学习管理与数据整理，不得用于任何违反学校政策、平台条款或适用法律法规的行为。  
3. **本地处理与数据责任**：扩展默认在本地浏览器处理数据，不主动上传成绩信息；但导出的 CSV 文件由用户自行保管，因分享、泄露或误用造成的后果由用户自行承担。  
4. **风险自担**：您应自行评估并承担使用风险。开发者不对因使用或无法使用本扩展产生的任何直接、间接、附带或衍生损失负责（包括但不限于数据偏差、数据丢失、账号异常、学习管理决策失误等）。  
5. **可用性与兼容性**：目标网站结构、接口策略或浏览器机制变化，可能导致功能中断、延迟或失效；开发者不承诺持续可用、实时修复或特定结果准确性。  
6. **合规义务**：使用前请确认您对相关数据具有合法访问与导出权限；如涉及学校或机构规范，请优先遵循其管理要求。  

本项目按 **"AS IS"**（现状）提供，不提供任何明示或暗示担保，包括但不限于适销性、特定用途适配性和不侵权担保。

如需查看更完整、更正式的条款说明，请参阅：[完整免责声明](docs/DISCLAIMER.md)。

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

