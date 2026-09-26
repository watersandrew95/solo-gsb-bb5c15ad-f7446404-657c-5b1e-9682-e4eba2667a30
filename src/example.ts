/**
 * 预置的可编辑示例。演奏侧（measures）覆盖四种典型情况，参考侧（referenceMeasures）
 * 小节数与演奏侧相同，演示双侧时值校验与发声轮廓对照：
 *  1. 两侧时值均正确，但发声轮廓不同（最早差异：演奏起声 / 参考休止）
 *  2. 演奏超出、参考正确 —— 只显示时值问题，不做轮廓对照
 *  3. 演奏不足、参考超出 —— 两侧均只显示时值问题
 *  4. 两侧时值均正确，事件拆分不同但发声轮廓一致（全小节发声）
 */
export const EXAMPLE_JSON = `{
  "timeSignature": { "numerator": 4, "denominator": 4 },
  "measures": [
    {
      "events": [
        { "type": "note", "denominator": 4 },
        { "type": "note", "denominator": 4, "dot": true },
        { "type": "rest", "denominator": 8 },
        {
          "type": "tuplet",
          "actual": 3,
          "inTimeOf": 2,
          "events": [
            { "type": "note", "denominator": 8 },
            { "type": "note", "denominator": 8 },
            { "type": "note", "denominator": 8 }
          ]
        }
      ]
    },
    {
      "events": [
        { "type": "note", "denominator": 2 },
        { "type": "note", "denominator": 2 },
        { "type": "note", "denominator": 8 }
      ]
    },
    {
      "events": [
        { "type": "note", "denominator": 2 },
        { "type": "rest", "denominator": 4 }
      ]
    },
    {
      "events": [
        { "type": "note", "denominator": 2 },
        {
          "type": "tuplet",
          "actual": 3,
          "inTimeOf": 2,
          "events": [
            { "type": "note", "denominator": 4 },
            {
              "type": "tuplet",
              "actual": 3,
              "inTimeOf": 2,
              "events": [
                { "type": "note", "denominator": 8 },
                { "type": "note", "denominator": 8 },
                { "type": "note", "denominator": 8 }
              ]
            },
            { "type": "note", "denominator": 4 }
          ]
        }
      ]
    }
  ],
  "referenceMeasures": [
    {
      "events": [
        { "type": "rest", "denominator": 8 },
        { "type": "note", "denominator": 4 },
        { "type": "note", "denominator": 4, "dot": true },
        {
          "type": "tuplet",
          "actual": 3,
          "inTimeOf": 2,
          "events": [
            { "type": "note", "denominator": 8 },
            { "type": "note", "denominator": 8 },
            { "type": "note", "denominator": 8 }
          ]
        }
      ]
    },
    {
      "events": [
        { "type": "note", "denominator": 4 },
        { "type": "note", "denominator": 4 },
        { "type": "note", "denominator": 4 },
        { "type": "note", "denominator": 4 }
      ]
    },
    {
      "events": [
        { "type": "note", "denominator": 1 },
        { "type": "note", "denominator": 8 }
      ]
    },
    {
      "events": [
        { "type": "note", "denominator": 1 }
      ]
    }
  ]
}
`;
