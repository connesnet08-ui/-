# Vercel 部署说明

## 1. 重新生成 SiliconFlow API Key

当前项目通过服务端 API Route 调用 SiliconFlow，不要把旧 key 继续用于公网部署。

1. 登录 SiliconFlow 控制台。
2. 进入 API Key / 密钥管理页面。
3. 删除或停用已经暴露过的旧密钥。
4. 新建一个密钥，只在 Vercel 环境变量中使用。

不要把真实密钥写进代码、截图、README、聊天记录或前端环境变量。

## 2. 上传到 GitHub

如果当前目录还不是 Git 仓库，可以在项目根目录执行：

```bash
git init
git add .
git commit -m "Prepare Next.js app for Vercel deployment"
git branch -M main
git remote add origin https://github.com/<your-name>/<your-repo>.git
git push -u origin main
```

上传前确认 `.gitignore` 包含：

```text
.env
.env.local
.env.*.local
node_modules
.next
out
```

`.env.local` 只能留在本机，不要提交到 GitHub。

## 3. 在 Vercel 导入 GitHub 仓库

1. 打开 Vercel Dashboard。
2. 点击 Add New Project / New Project。
3. 选择 GitHub 账号并导入这个仓库。
4. Framework Preset 选择 Next.js。
5. Build Command 使用默认的 `npm run build`。
6. Install Command 使用默认的 `npm install`。

Vercel 官方文档：
- Next.js 部署：https://vercel.com/docs/concepts/next.js/overview
- 导入 Git 仓库：https://vercel.com/docs/getting-started-with-vercel/import

## 4. 配置环境变量

在 Vercel 项目中进入 Settings -> Environment Variables，添加：

```text
SILICONFLOW_API_KEY=新的 SiliconFlow 密钥
```

可选配置：

```text
SILICONFLOW_MODEL=Qwen/Qwen3-8B
```

`SILICONFLOW_MODEL` 不配置也可以，代码里默认使用 `Qwen/Qwen3-8B`。

添加变量时，Production 和 Preview 环境都可以勾选。Vercel 环境变量文档：https://vercel.com/docs/environment-variables

## 5. 重新部署

添加或修改环境变量后，需要重新部署：

1. 进入 Vercel 项目的 Deployments 页面。
2. 找到最新部署。
3. 点击 Redeploy。

部署成功后，Vercel 会生成类似下面的公网链接：

```text
https://your-project.vercel.app
```

把这个链接发给别人，对方就可以用手机访问。

## 6. 安全注意事项

- 前端只能请求本项目的 `/api/translate`。
- SiliconFlow 请求只允许放在 `app/api/translate/route.js` 这类服务端 API Route 中。
- API Key 只能通过 `process.env.SILICONFLOW_API_KEY` 在服务端读取。
- 不要把 SiliconFlow API Key 放进任何以 `NEXT_PUBLIC_` 开头的变量。
- `NEXT_PUBLIC_` 变量会进入浏览器环境，不能存放密钥。
- 不要提交 `.env.local`。
- 如果密钥曾经暴露过，先去 SiliconFlow 控制台重新生成新 key，再部署。
