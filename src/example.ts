/**
 * 预置的可编辑示例，覆盖四种典型情况：
 *  1. 时值正确（含附点与三连音）
 *  2. 超出（演示首个越界叶事件定位）
 *  3. 不足
 *  4. 时值正确（两层连音嵌套）
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
  ]
}
`;
