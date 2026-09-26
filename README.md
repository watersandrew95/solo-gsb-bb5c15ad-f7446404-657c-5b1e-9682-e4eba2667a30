# 节奏小节校对

一个用于校对乐谱小节时值的网页工具（React + TypeScript）。粘贴含拍号、逐小节事件树与**可选参考演奏**的 JSON，即可以精确分数逐小节核算应有时值、实际时值与不足/超出量；超出时定位首个越界叶事件的树路径，非法输入逐条指出树路径。提供 `referenceMeasures` 时，还会在两侧时值都正确的小节对照**发声轮廓**（音符发声 / 休止符静音），等价的事件拆分不影响结果，轮廓不同时给出最早差异区间、两侧状态与原事件树路径。

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
  ],
  "referenceMeasures": [
    {
      "events": [
        { "type": "note", "denominator": 4 }
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

### 参考演奏对照（referenceMeasures，可选）

- `referenceMeasures` 小节数必须与 `measures` 相同，事件结构沿用相同规则，可省略。
- 两侧分别校验并显示时值结果；任一对应小节未填满拍号或超出时，该小节**只显示时值问题**，不做轮廓比较。
- 两侧时值都正确的小节，将嵌套连音按沿途倍率（`inTimeOf`/`actual` 连乘）展开为精确分数时间段：音符视为发声、休止符视为静音。
- 合并相邻同状态片段后比较整小节发声区间，因此等价的事件拆分（如两个八分音符与一个四分音符）不影响结果。
- 轮廓不同时，显示**最早差异区间**的起止时刻（以全音符为 1 的精确分数，并折合拍数）、两侧状态（发声 / 静音）与原事件树路径；轮廓相同时标记「演奏轮廓一致」。
- 参考侧的非法输入以 `referenceMeasures[i].events[…]` 前缀逐条指出。

## 本地开发（可选）

```bash
npm install
npm run dev      # 开发服务器
npm run build    # 类型检查并产出 dist/
```
