import { useMemo, useState } from 'react';
import { EXAMPLE_JSON } from './example';
import type { Frac } from './fraction';
import {
  ALLOWED_DENOMINATORS,
  MAX_TUPLET_DEPTH,
  analyze,
  validateScore,
  type MeasureReport,
  type MeasureStatus,
  type OutlineComparison,
  type OutlineDiff,
  type ScoreInput,
  type SegmentState,
} from './rhythm';

type ParseResult = { ok: true; value: unknown } | { ok: false; message: string };

function parseJson(text: string): ParseResult {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** 时刻/时值展示：最简分数，必要时附带分数 */
function fmtFrac(f: Frac): string {
  const s = f.toString();
  const mixed = f.toMixed();
  return s === mixed ? s : `${s}（${mixed}）`;
}

function StatusBadge({ status, diff }: { status: MeasureStatus; diff: Frac }) {
  return (
    <span className={`badge badge-${status}`}>
      {status === 'ok' && '✓ 时值正确'}
      {status === 'short' && `不足 ${diff.abs().toString()}`}
      {status === 'over' && `超出 ${diff.abs().toString()}`}
    </span>
  );
}

/** 单侧时值明细（应有 / 实际 / 差值 / 越界定位） */
function MeasureFacts({ report }: { report: MeasureReport }) {
  const { expected, actual, diff, status, overflowPath } = report;
  return (
    <div className="measure-body">
      <div>
        <span className="label">应有时值</span>
        <span className="value">{expected.toString()}</span>
        {expected.toString() !== expected.toMixed() && (
          <span className="mixed">（{expected.toMixed()}）</span>
        )}
      </div>
      <div>
        <span className="label">实际时值</span>
        <span className="value">{actual.toString()}</span>
        {actual.toString() !== actual.toMixed() && (
          <span className="mixed">（{actual.toMixed()}）</span>
        )}
      </div>
      <div>
        <span className="label">差值</span>
        <span className="value">
          {diff.sign() === 0 ? '0' : `${diff.sign() > 0 ? '+' : '-'}${diff.abs().toString()}`}
        </span>
        <span className="mixed">（以全音符为 1）</span>
      </div>
      {status === 'over' && overflowPath && (
        <div className="overflow-path">
          首个越界叶事件：<code>{overflowPath}</code>
        </div>
      )}
    </div>
  );
}

function MeasureCard({ report }: { report: MeasureReport }) {
  const { index, status, diff } = report;
  return (
    <div className={`measure measure-${status}`}>
      <div className="measure-head">
        <span className="measure-title">第 {index} 小节</span>
        <StatusBadge status={status} diff={diff} />
      </div>
      <MeasureFacts report={report} />
    </div>
  );
}

function StateTag({ state }: { state: SegmentState }) {
  return (
    <span className={`state state-${state}`}>{state === 'sounding' ? '发声' : '静音'}</span>
  );
}

function DiffDetail({ diff }: { diff: OutlineDiff }) {
  return (
    <div className="diff-detail">
      <div className="diff-title">最早差异区间</div>
      <div className="diff-row">
        <span className="label">区间</span>
        <span className="value">
          [{fmtFrac(diff.start)}, {fmtFrac(diff.end)})
        </span>
        <span className="mixed">（以全音符为 1，从小节起点计）</span>
      </div>
      <div className="diff-row">
        <span className="label">记谱</span>
        <StateTag state={diff.scoreState} />
        <code>{diff.scorePath}</code>
      </div>
      <div className="diff-row">
        <span className="label">参考</span>
        <StateTag state={diff.referenceState} />
        <code>{diff.referencePath}</code>
      </div>
    </div>
  );
}

/** 对照卡片：两侧时值结果 + 演奏轮廓对照结论 */
function CompareCard({
  score,
  reference,
  comparison,
}: {
  score: MeasureReport;
  reference: MeasureReport;
  comparison: OutlineComparison | null;
}) {
  // 未对照时取两侧较差状态着色（over 优先于 short）
  const worst: MeasureStatus =
    score.status === 'over' || reference.status === 'over'
      ? 'over'
      : score.status === 'short' || reference.status === 'short'
        ? 'short'
        : 'ok';
  const cardStatus =
    comparison === null ? worst : comparison.kind === 'match' ? 'ok' : 'over';

  return (
    <div className={`measure measure-${cardStatus}`}>
      <div className="measure-head">
        <span className="measure-title">第 {score.index} 小节</span>
        {comparison === null ? (
          <span className={`badge badge-${worst}`}>未对照 · 存在时值问题</span>
        ) : comparison.kind === 'match' ? (
          <span className="badge badge-ok">✓ 演奏轮廓一致</span>
        ) : (
          <span className="badge badge-over">✗ 演奏轮廓不同</span>
        )}
      </div>
      <div className="compare-sides">
        <div className="side">
          <div className="side-head">
            <span className="side-label">记谱</span>
            <StatusBadge status={score.status} diff={score.diff} />
          </div>
          <MeasureFacts report={score} />
        </div>
        <div className="side">
          <div className="side-head">
            <span className="side-label">参考演奏</span>
            <StatusBadge status={reference.status} diff={reference.diff} />
          </div>
          <MeasureFacts report={reference} />
        </div>
      </div>
      {comparison === null ? (
        <div className="compare-note">对应小节存在时值问题，修正后再进行演奏轮廓对照。</div>
      ) : (
        comparison.kind === 'diff' && <DiffDetail diff={comparison.diff} />
      )}
    </div>
  );
}

export default function App() {
  const [text, setText] = useState(EXAMPLE_JSON);

  const parsed = useMemo(() => parseJson(text), [text]);
  const errors = useMemo(() => (parsed.ok ? validateScore(parsed.value) : []), [parsed]);
  const report = useMemo(
    () => (parsed.ok && errors.length === 0 ? analyze(parsed.value as ScoreInput) : null),
    [parsed, errors],
  );

  const ts = parsed.ok && errors.length === 0 ? (parsed.value as ScoreInput).timeSignature : null;

  return (
    <div className="page">
      <header>
        <h1>节奏小节校对</h1>
        <p className="subtitle">
          粘贴含拍号与逐小节事件树的 JSON，按精确分数核算每个小节的应有 /
          实际时值；可提供参考演奏，逐小节对照发声轮廓
        </p>
      </header>

      <main>
        <section className="panel editor-panel">
          <div className="panel-head">
            <h2>输入 JSON</h2>
            <div className="actions">
              <button onClick={() => setText(EXAMPLE_JSON)}>载入示例</button>
              <button
                onClick={() => {
                  if (parsed.ok) setText(JSON.stringify(parsed.value, null, 2));
                }}
                disabled={!parsed.ok}
              >
                格式化
              </button>
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder="在此粘贴 JSON…"
          />
        </section>

        <section className="panel result-panel">
          <div className="panel-head">
            <h2>校对结果</h2>
            {ts && report && (
              <span className="ts">
                拍号 {ts.numerator}/{ts.denominator} · 共 {report.measures.length} 小节
                {report.reference !== null && ' · 含参考演奏对照'}
              </span>
            )}
          </div>

          {!parsed.ok && (
            <div className="alert alert-error">
              <strong>JSON 解析失败</strong>
              <pre>{parsed.message}</pre>
            </div>
          )}

          {parsed.ok && errors.length > 0 && (
            <div className="alert alert-error">
              <strong>发现 {errors.length} 处非法输入</strong>
              <ul className="error-list">
                {errors.map((err, i) => (
                  <li key={i}>
                    <code>{err.path}</code>
                    <span>{err.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {parsed.ok && errors.length === 0 && report && (
            <div className="measures">
              {report.reference === null
                ? report.measures.map((r) => <MeasureCard key={r.index} report={r} />)
                : report.measures.map((r, i) => (
                    <CompareCard
                      key={r.index}
                      score={r}
                      reference={report.reference![i]}
                      comparison={report.comparisons![i]}
                    />
                  ))}
            </div>
          )}
        </section>
      </main>

      <section className="panel docs">
        <h2>格式说明</h2>
        <div className="docs-grid">
          <div>
            <h3>顶层结构</h3>
            <pre>{`{
  "timeSignature": {
    "numerator": 4,      // 拍号分子，正整数
    "denominator": 4     // 拍号分母，限 ${ALLOWED_DENOMINATORS.join('/')}
  },
  "measures": [
    { "events": [ /* 事件… */ ] }
  ],
  // 可选：参考演奏，小节数须与 measures 相同
  "referenceMeasures": [
    { "events": [ /* 事件… */ ] }
  ]
}`}</pre>
            <h3>时值规则</h3>
            <ul>
              <li>
                时值以全音符为 1；<code>denominator</code> 表示全音符的几分之一，限{' '}
                {ALLOWED_DENOMINATORS.join('、')}。
              </li>
              <li>
                <code>dot: true</code> 表示带一个附点，时值 ×3/2；可省略（无附点）。
              </li>
              <li>
                连音组内各事件时值之和 × <code>inTimeOf</code>/<code>actual</code>
                （占用数/实际数），最多 {MAX_TUPLET_DEPTH} 层嵌套。
              </li>
              <li>
                拍号分子、连音的 <code>actual</code> 与 <code>inTimeOf</code> 必须为正整数。
              </li>
              <li>小节应有时值 = 拍号分子 / 拍号分母。</li>
            </ul>
          </div>
          <div>
            <h3>三种事件</h3>
            <pre>{`// 音符（附点可省略）
{ "type": "note", "denominator": 4, "dot": true }

// 休止符
{ "type": "rest", "denominator": 8 }

// 连音组（可嵌套，最多 ${MAX_TUPLET_DEPTH} 层）
{
  "type": "tuplet",
  "actual": 3,     // 实际数，正整数
  "inTimeOf": 2,   // 占用数，正整数
  "events": [ /* 子事件… */ ]
}`}</pre>
            <h3>结果解读</h3>
            <ul>
              <li>逐小节给出应有时值、实际时值与差值（不足 / 超出量）。</li>
              <li>
                超出时定位首个越界叶事件的树路径，如 <code>measures[1].events[2]</code>。
              </li>
              <li>非法输入会逐条指出树路径与原因。</li>
            </ul>
            <h3>参考演奏对照</h3>
            <ul>
              <li>
                提供 <code>referenceMeasures</code> 后逐小节对照：两侧分别核算时值，
                任一侧不足或超出时仅显示时值问题，不做对照。
              </li>
              <li>
                两侧时值均正确时，将嵌套连音按沿途倍率展开为精确分数时间段，
                音符视为发声、休止符视为静音。
              </li>
              <li>
                合并相邻同状态片段后比较整小节发声区间，等价的事件拆分
                （如 1/8+1/8 与 1/4）视为一致。
              </li>
              <li>
                轮廓不同则给出最早差异区间的起止时刻、两侧状态（发声 / 静音）
                及两侧原事件树路径；相同则标记「演奏轮廓一致」。
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
