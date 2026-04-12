# cheatsheet-app

Project skeleton for cheatsheet-app (frontend + backend).
# Cheatsheet App

把课程资料转成可打印、可调布局、适合考前冲刺的速查表。

Cheatsheet App 是一个面向考试复习场景的小型全栈应用。它不是做“长篇总结”，而是把讲义、笔记、教材片段提炼成结构化知识块，再压缩进 A4 页面里，方便快速浏览、临考打印和高密度复习。

## 为什么做这个

普通 AI 总结通常有两个问题：

- 太像文章，不像速查表
- 信息很多，但不适合真正塞进一页纸里

这个项目关注的是另一件事：

- 抽取考试导向的信息块，而不是泛泛总结
- 保留定义、公式、对比、易错点、步骤等高价值内容
- 让用户主动控制密度、重要性阈值和页面布局
- 在导出前实时预览，确保内容真的能放进纸面

## 核心功能

- 粘贴课程资料、lecture notes、markdown 或教材片段
- 使用 LLM 抽取结构化 blocks
- 支持公式以 LaTeX 形式保留和渲染
- 在编辑器中实时调整版式与信息密度
- 支持列表视图和思维导图视图
- 支持隐藏、恢复、移动、锁定重点内容
- 导出 PDF，若本机缺少 LaTeX 引擎则回退为 `.tex`

## 产品流程

1. 在创建页粘贴原始资料
2. 可选填写考试重点或偏好
3. 后端调用 LLM 抽取结构化知识块
4. 前端进入编辑页进行排版和筛选
5. 调整目标页数、阈值、布局模式
6. 导出为 PDF 或 LaTeX

## 技术栈

### Frontend
- React
- TypeScript
- Vite
- React Router
- KaTeX
- d3-hierarchy

### Backend
- FastAPI
- Pydantic
- Jinja2
- OpenAI SDK
- OpenRouter API

## 本地运行

### 1. 启动后端

进入 `backend/`，复制环境变量模板并填写 API Key：

```powershell
cd backend
copy .env.example .env
