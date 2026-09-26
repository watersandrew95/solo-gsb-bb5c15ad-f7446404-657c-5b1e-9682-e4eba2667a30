import { useMemo, useState } from 'react';
import { EXAMPLE_JSON } from './example';
import { Frac } from './fraction';
import {
  ALLOWED_DENOMINATORS,
  MAX_TUPLET_DEPTH,
  analyze,
  validateScore,
  type ContourDifference,
  type MeasureReport,
  type ScoreInput,
  type SideReport,
  type SoundState,
} from './rhythm';

type ParseResult = { ok: true; value: unknown } | { ok: false; message: string };

function parseJson(text: string): ParseResult {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

const STATUS_TEXT: Record<SideReport['status'], (r: SideReport) => string> = {
  ok: () => '✓ 时值正确',
  short: (r) => `不足 ${r.diff.abs().toString()}`,
  over: (r) => `超出 ${r.diff.abs().toString()}`,
};

const STATE_TEXT: Record<SoundState, string> = {
  sounding: '发声',
  silent: '静音',
};

function DurationRow({ side, label }: { side: SideReport; label: string }) {
  const { expected, actual, diff, status, overflowPath } = side;
  return (
    <div className={`side side-${status}`}>
      <div className="side-head">
        <span className="side-label">{label}</span>
        <span className={`badge badge-${status}`}>{STATUS_TEXT[status](side)}</span>
      </div>
      <div className="side-body">
        <div>
          <span className="label">应有</span>
          <span className="value">{expected.toString()}</span>
          {expected.toString() !== expected.toMixed() && (
            <span className="mixed">（{expected.toMixed()}）</span>
          )}
        </div>
        <div>
          <span className="label">实际</span>
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
    </div>
  );
}

/** 时刻：精确分数（以全音符为 1）+ 折合拍数 */
function TimeText({ t, beatUnit }: { t: Frac; beatUnit: number }) {
  const beats = t.mul(Frac.of(beatUnit));
  return (
    <>
      <code>{t.toString()}</code>
      <span className="mixed">
        （{beats.sign() === 0 ? '0' : beats.toString()} 拍）
      </span>
    </>
  );
}

function ContourPanel({ report, beatUnit }: { report: MeasureReport; beatUnit: number }) {
  const { contour } = report;
  if (!contour) return null;

  if (contour.kind === 'match') {
    return (
      <div className="contour contour-match">
        <span className="badge badge-contour-ok">♪ 演奏轮廓一致</span>
        <span className="contour-hint">两侧整小节发声区间相同（事件拆分差异已忽略）</span>
      </div>
    );
  }

  const d: ContourDifference = contour.difference;
  return (
    <div className="contour contour-differ">
      <div className="contour-title">
        <span className="badge badge-contour-diff">✗ 演奏轮廓不同</span>
        <span className="contour-hint">最早差异区间：</span>
        <span className="time-range">
          <TimeText t={d.start} beatUnit={beatUnit} />
          <span className="range-sep"> – </span>
          <TimeText t={d.end} beatUnit={beatUnit} />
        </span>
      </div>
      <div className="contour-sides">
        <div className="contour-side">
          <span className="side-label">演奏</span>
          <span className={`state state-${d.performance.state}`}>{STATE_TEXT[d.performance.state]}</span>
          <code>{d.performance.path}</code>
        </div>
        <div className="contour-side">
          <span className="side-label">参考</span>
          <span className={`state state-${d.reference.state}`}>{STATE_TEXT[d.reference.state]}</span>
          <code>{d.reference.path}</code>
        </div>
      </div>
    </div>
  );
}

function MeasureCard({ report, beatUnit, hasReference }: { report: MeasureReport; beatUnit: number; hasReference: boolean }) {
  const p = report.performance;
  const r = report.reference;
  // 卡片整体状态：任一侧非 ok 即为时值问题；两侧都 ok 才看轮廓
  const timeOk = p.status === 'ok' && (!r || r.status === 'ok');
  const cardClass = !hasReference
    ? `measure-${p.status}`
    : !timeOk
      ? 'measure-time-issue'
      : report.contour?.kind === 'match'
        ? 'measure-contour-match'
        : 'measure-contour-differ';

  let headBadge: { cls: string; text: string };
  if (!hasReference) {
    headBadge = { cls: `badge-${p.status}`, text: STATUS_TEXT[p.status](p) };
  } else if (!timeOk) {
    headBadge = { cls: 'badge-over', text: '时值问题' };
  } else if (report.contour?.kind === 'match') {
    headBadge = { cls: 'badge-contour-ok', text: '♪ 演奏轮廓一致' };
  } else {
    headBadge = { cls: 'badge-contour-diff', text: '✗ 演奏轮廓不同' };
  }

  return (
    <div className={`measure ${cardClass}`}>
      <div className="measure-head">
        <span className="measure-title">第 {report.index} 小节</span>
        <span className={`badge ${headBadge.cls}`}>{headBadge.text}</span>
      </div>
      <div className="side-grid">
        <DurationRow side={p} label="演奏（measures）" />
        {r && <DurationRow side={r} label="参考（referenceMeasures）" />}
      </div>
      {hasReference && <ContourPanel report={report} beatUnit={beatUnit} />}
    </div>
  );
}

export default function App() {
  const [text, setText] = useState(EXAMPLE_JSON);

  const parsed = useMemo(() => parseJson(text), [text]);
  const errors = useMemo(() => (parsed.ok ? validateScore(parsed.value) : []), [parsed]);
  const validScore = parsed.ok && errors.length === 0 ? (parsed.value as ScoreInput) : null;
  const reports = useMemo(() => (validScore ? analyze(validScore) : []), [validScore]);

  const ts = validScore ? validScore.timeSignature : null;
  const hasReference = !!validScore?.referenceMeasures;

  return (
    <div className="page">
      <header>
        <h1>节奏小节校对</h1>
        <p className="subtitle">
          粘贴含拍号、逐小节事件树与可选参考演奏的 JSON，按精确分数核算每小节时值，
          并在两侧时值均正确时对照发声轮廓
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
            {ts && (
              <span className="ts">
                拍号 {ts.numerator}/{ts.denominator} · 共 {reports.length} 小节
                {hasReference ? ' · 含参考演奏对照' : ''}
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

          {validScore && (
            <div className="measures">
              {reports.map((rpt) => (
                <MeasureCard key={rpt.index} report={rpt} beatUnit={ts!.denominator} hasReference={hasReference} />
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
    { "events": [ /* 演奏事件… */ ] }
  ],
  // 可选：参考演奏，小节数必须与 measures 相同
  "referenceMeasures": [
    { "events": [ /* 参考事件… */ ] }
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
            <h3>参考演奏对照</h3>
            <ul>
              <li>
                <code>referenceMeasures</code> 可省略；提供时与 <code>measures</code>{' '}
                逐小节对应，事件结构沿用相同规则，分别校验并显示两侧时值。
              </li>
              <li>任一对应小节未填满拍号或超出时，该小节只显示时值问题，不做轮廓比较。</li>
              <li>
                两侧时值都正确时，嵌套连音按沿途倍率展开为精确分数时间段：
                音符为发声、休止符为静音；合并相邻同状态片段后比较整小节发声区间，
                等价的事件拆分（如两个八分音符与一个四分音符）不影响结果。
              </li>
              <li>
                轮廓不同时给出最早差异区间的起止时刻（全音符分数及折合拍数）、
                两侧状态（发声 / 静音）与原事件树路径；相同时标记「演奏轮廓一致」。
              </li>
              <li>
                参考侧非法输入路径以 <code>referenceMeasures[…]</code> 前缀逐条指出。
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
