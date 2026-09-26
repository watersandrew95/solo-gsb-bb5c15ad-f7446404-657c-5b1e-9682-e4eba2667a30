# 节奏小节校对

一个用于校对乐谱小节时值的网页工具（React + TypeScript）。粘贴含拍号与逐小节事件树的 JSON，即可以精确分数逐小节核算应有时值、实际时值与不足/超出量；超出时定位首个越界叶事件的树路径，非法输入逐条指出树路径。

## 启动

```bash
docker compose up --build
```

启动后访问 **http://localhost:8080** 即可使用（页面已预置可编辑示例与格式说明）。

> 端口映射见 `docker-compose.yml`（宿主 8080 → 容器 80）。如需更换端口，修改 `ports` 即可。

## 输入格式

```json
{
  "timeSignature": { "numerator": 4, "denominator": 4 },
  "measures": [
    {
      "events": [
        { "type": "note", "denominator": 4, "dot": true },
        { "type": "rest", "denominator": 8 },
        {
          "type": "tuplet",
          "actual": 3,
          "inTimeOf": 2,
          "events": [{ "type": "note", "denominator": 8 }]
        }
      ]
    }
  ]
}
```

规则：

- 时值以全音符为 1，`denominator` 表示全音符的几分之一，限 1、2、4、8、16、32（拍号、音符、休止符相同）。
- `dot: true` 表示带一个附点，时值 ×3/2；可省略。
- 连音组内时值之和 × `inTimeOf`/`actual`（占用数/实际数），最多三层嵌套。
- 拍号分子、连音的 `actual` 与 `inTimeOf` 必须为正整数。
- 所有计算基于 BigInt 精确分数，无浮点误差。

## 本地开发（可选）

```bash
npm install
npm run dev      # 开发服务器
npm run build    # 类型检查并产出 dist/
```
