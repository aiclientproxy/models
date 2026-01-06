# AI Client Proxy Models

统一管理 AI 模型元数据的数据仓库，为 [ProxyCast](https://github.com/aiclientproxy/proxycast) 和其他项目提供模型信息。

## 特性

- 📦 **统一数据源** - 集中管理所有 AI 提供商的模型数据
- 🔄 **自动同步** - 定期从 [models.dev](https://models.dev) 同步最新模型
- 🇨🇳 **国内模型支持** - 包含阿里云、智谱、DeepSeek 等国内模型
- 🔗 **别名映射** - 支持中转服务（Antigravity、Kiro）的模型别名

## 目录结构

```
models/
├── providers/          # 各提供商的模型数据
│   ├── anthropic.json
│   ├── openai.json
│   ├── google.json
│   ├── dashscope.json  # 阿里云百炼
│   ├── zhipu.json      # 智谱 AI
│   └── ...
├── aliases/            # 模型别名映射
│   ├── antigravity.json
│   └── kiro.json
├── schema/             # JSON Schema 定义
│   └── model.schema.json
├── scripts/            # 同步和验证脚本
│   ├── sync-models-dev.ts
│   └── validate.ts
└── index.json          # 索引文件
```

## 使用方法

### 获取模型数据

```bash
# 获取索引
curl https://raw.githubusercontent.com/aiclientproxy/models/main/index.json

# 获取特定提供商的模型
curl https://raw.githubusercontent.com/aiclientproxy/models/main/providers/anthropic.json
```

### 本地开发

```bash
# 安装依赖
pnpm install

# 从 models.dev 同步数据
pnpm run sync

# 验证数据格式
pnpm run validate
```

## 数据格式

### 模型数据 (providers/*.json)

```json
{
  "provider": {
    "id": "anthropic",
    "name": "Anthropic"
  },
  "models": [
    {
      "id": "claude-opus-4-5-20251101",
      "name": "Claude Opus 4.5",
      "family": "opus",
      "tier": "max",
      "capabilities": {
        "vision": true,
        "tools": true,
        "streaming": true,
        "reasoning": true
      },
      "pricing": {
        "input": 15.0,
        "output": 75.0,
        "currency": "USD"
      },
      "limits": {
        "context": 200000,
        "max_output": 32000
      }
    }
  ]
}
```

### 别名映射 (aliases/*.json)

```json
{
  "provider": "antigravity",
  "aliases": {
    "gemini-claude-sonnet-4-5": {
      "actual": "claude-sonnet-4-5-20250929",
      "provider": "anthropic"
    }
  }
}
```

## 贡献

欢迎提交 PR 添加或更新模型数据，特别是：

- 国内模型提供商的新模型
- 模型定价和能力的更新
- 新的中转服务别名映射

## 许可证

MIT
