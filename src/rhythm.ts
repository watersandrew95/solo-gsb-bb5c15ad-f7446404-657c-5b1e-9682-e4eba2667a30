import { Frac } from './fraction';

export const ALLOWED_DENOMINATORS = [1, 2, 4, 8, 16, 32] as const;
export const MAX_TUPLET_DEPTH = 3;

/* ---------- 输入 JSON 的类型 ---------- */

export interface NoteEvent {
  type: 'note';
  denominator: number;
  dot?: boolean;
}

export interface RestEvent {
  type: 'rest';
  denominator: number;
  dot?: boolean;
}

export interface TupletEvent {
  type: 'tuplet';
  /** 实际数：连音组内实际包含的音符个数基准 */
  actual: number;
  /** 占用数：这些音符占用多少个同类型正常音符的时值 */
  inTimeOf: number;
  events: RhythmEvent[];
}

export type RhythmEvent = NoteEvent | RestEvent | TupletEvent;

export interface TimeSignature {
  numerator: number;
  denominator: number;
}

export interface MeasureInput {
  events: RhythmEvent[];
}

export interface ScoreInput {
  timeSignature: TimeSignature;
  measures: MeasureInput[];
}

/* ---------- 校验 ---------- */

export interface AnalysisError {
  /** 树路径，如 timeSignature.numerator 或 measures[0].events[2].events[1].denominator */
  path: string;
  message: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isPositiveInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

function isAllowedDenominator(v: unknown): v is number {
  return typeof v === 'number' && (ALLOWED_DENOMINATORS as readonly number[]).includes(v);
}

const DENOMINATOR_HINT = `必须是 ${ALLOWED_DENOMINATORS.join('、')} 之一（全音符的几分之一）`;

/**
 * 校验整份输入。所有错误均携带树路径。
 * depth 表示当前事件所在的连音嵌套层数（连音组之外为 0）。
 */
export function validateScore(input: unknown): AnalysisError[] {
  const errors: AnalysisError[] = [];

  if (!isRecord(input)) {
    errors.push({ path: '$', message: '根节点必须是 JSON 对象' });
    return errors;
  }

  const ts = input.timeSignature;
  if (!isRecord(ts)) {
    errors.push({ path: 'timeSignature', message: '必须是对象 { "numerator": 分子, "denominator": 分母 }' });
  } else {
    if (!isPositiveInteger(ts.numerator)) {
      errors.push({ path: 'timeSignature.numerator', message: '拍号分子必须是正整数' });
    }
    if (!isAllowedDenominator(ts.denominator)) {
      errors.push({ path: 'timeSignature.denominator', message: `拍号分母${DENOMINATOR_HINT}` });
    }
  }

  const measures = input.measures;
  if (!Array.isArray(measures) || measures.length === 0) {
    errors.push({ path: 'measures', message: '必须是非空数组，每个元素为一个小节' });
  } else {
    measures.forEach((m, mi) => {
      const mPath = `measures[${mi}]`;
      if (!isRecord(m) || !Array.isArray(m.events)) {
        errors.push({ path: mPath, message: '每个小节必须是含 events 数组的对象' });
        return;
      }
      if (m.events.length === 0) {
        errors.push({ path: `${mPath}.events`, message: '小节至少包含一个事件' });
      }
      m.events.forEach((e, ei) => validateEvent(e, `${mPath}.events[${ei}]`, 0, errors));
    });
  }

  return errors;
}

function validateEvent(node: unknown, path: string, depth: number, errors: AnalysisError[]): void {
  if (!isRecord(node)) {
    errors.push({ path, message: '事件必须是对象' });
    return;
  }

  switch (node.type) {
    case 'note':
    case 'rest': {
      const label = node.type === 'note' ? '音符' : '休止符';
      if (!isAllowedDenominator(node.denominator)) {
        errors.push({ path: `${path}.denominator`, message: `${label}分母${DENOMINATOR_HINT}` });
      }
      if (node.dot !== undefined && typeof node.dot !== 'boolean') {
        errors.push({ path: `${path}.dot`, message: '附点标记 dot 必须是布尔值（可省略，省略表示无附点）' });
      }
      break;
    }
    case 'tuplet': {
      const nextDepth = depth + 1;
      if (nextDepth > MAX_TUPLET_DEPTH) {
        errors.push({ path, message: `连音组嵌套最多允许 ${MAX_TUPLET_DEPTH} 层` });
      }
      if (!isPositiveInteger(node.actual)) {
        errors.push({ path: `${path}.actual`, message: '连音实际数 actual 必须是正整数' });
      }
      if (!isPositiveInteger(node.inTimeOf)) {
        errors.push({ path: `${path}.inTimeOf`, message: '连音占用数 inTimeOf 必须是正整数' });
      }
      if (!Array.isArray(node.events) || node.events.length === 0) {
        errors.push({ path: `${path}.events`, message: '连音组必须包含非空 events 数组' });
      } else {
        node.events.forEach((e, i) => validateEvent(e, `${path}.events[${i}]`, nextDepth, errors));
      }
      break;
    }
    default:
      errors.push({
        path: `${path}.type`,
        message: `未知事件类型 ${JSON.stringify(node.type)}，应为 "note" / "rest" / "tuplet"`,
      });
  }
}

/* ---------- 时值计算 ---------- */

export type MeasureStatus = 'ok' | 'short' | 'over';

export interface MeasureReport {
  /** 小节序号（从 1 开始，用于展示） */
  index: number;
  /** 应有时值（拍号分子/分母，以全音符为 1） */
  expected: Frac;
  /** 实际时值 */
  actual: Frac;
  /** 实际 - 应有 */
  diff: Frac;
  status: MeasureStatus;
  /** 超出时，首个越界叶事件的树路径；否则为 null */
  overflowPath: string | null;
}

/** 叶事件（音符/休止符）时值：1/denominator，附点 ×3/2 */
function leafDuration(node: NoteEvent | RestEvent): Frac {
  const base = Frac.of(1, node.denominator);
  return node.dot ? base.mul(Frac.of(3, 2)) : base;
}

/** 事件时值：连音组 = 组内时值之和 × 占用数/实际数（递归） */
function eventDuration(node: RhythmEvent): Frac {
  if (node.type === 'tuplet') {
    const inner = node.events.reduce<Frac>((acc, e) => acc.add(eventDuration(e)), Frac.zero());
    return inner.mul(Frac.of(node.inTimeOf, node.actual));
  }
  return leafDuration(node);
}

/**
 * 按演奏顺序扫描事件，累计时值（连音组内按累计缩放系数折算），
 * 返回首个使累计时值超过 expected 的叶事件树路径。
 */
function findFirstOverflow(
  events: RhythmEvent[],
  expected: Frac,
  acc: Frac,
  scale: Frac,
  basePath: string,
): { overflowPath: string | null; acc: Frac } {
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const path = `${basePath}[${i}]`;
    if (e.type === 'tuplet') {
      const innerScale = scale.mul(Frac.of(e.inTimeOf, e.actual));
      const r = findFirstOverflow(e.events, expected, acc, innerScale, `${path}.events`);
      acc = r.acc;
      if (r.overflowPath !== null) return { overflowPath: r.overflowPath, acc };
    } else {
      acc = acc.add(leafDuration(e).mul(scale));
      if (acc.cmp(expected) > 0) return { overflowPath: path, acc };
    }
  }
  return { overflowPath: null, acc };
}

/** 逐小节分析。调用前须保证 validateScore 无错误。 */
export function analyze(score: ScoreInput): MeasureReport[] {
  const expected = Frac.of(score.timeSignature.numerator, score.timeSignature.denominator);

  return score.measures.map((m, mi) => {
    const actual = m.events.reduce<Frac>((acc, e) => acc.add(eventDuration(e)), Frac.zero());
    const diff = actual.sub(expected);
    const sign = diff.sign();
    const status: MeasureStatus = sign === 0 ? 'ok' : sign < 0 ? 'short' : 'over';

    let overflowPath: string | null = null;
    if (status === 'over') {
      overflowPath = findFirstOverflow(
        m.events,
        expected,
        Frac.zero(),
        Frac.of(1),
        `measures[${mi}].events`,
      ).overflowPath;
    }

    return { index: mi + 1, expected, actual, diff, status, overflowPath };
  });
}
