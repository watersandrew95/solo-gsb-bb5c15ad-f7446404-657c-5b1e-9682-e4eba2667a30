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
  /** 可选参考演奏；若提供，小节数必须与 measures 相同，事件结构规则一致 */
  referenceMeasures?: MeasureInput[];
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
    validateMeasureList(measures, 'measures', errors);
  }

  // referenceMeasures 可省略；若提供，事件结构规则与 measures 完全一致
  if (input.referenceMeasures !== undefined) {
    const refs = input.referenceMeasures;
    if (!Array.isArray(refs)) {
      errors.push({ path: 'referenceMeasures', message: '必须是数组，每个元素为一个小节（与 measures 同结构）' });
    } else {
      validateMeasureList(refs, 'referenceMeasures', errors);
      if (Array.isArray(measures)) {
        if (refs.length !== measures.length) {
          errors.push({
            path: 'referenceMeasures',
            message: `小节数必须与 measures 相同（measures 有 ${measures.length} 小节，referenceMeasures 有 ${refs.length} 小节）`,
          });
        }
      }
    }
  }

  return errors;
}

/** 逐小节校验一个小节列表（measures 或 referenceMeasures），错误路径带对应前缀 */
function validateMeasureList(
  measures: unknown[],
  rootName: 'measures' | 'referenceMeasures',
  errors: AnalysisError[],
): void {
  measures.forEach((m, mi) => {
    const mPath = `${rootName}[${mi}]`;
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
export type SoundState = 'sounding' | 'silent';

export interface SideReport {
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

/** 一个发声 / 静音片段（时间段为半开区间 [start, end)） */
export interface SoundSegment {
  start: Frac;
  end: Frac;
  state: SoundState;
  /** 产生该片段的叶事件原事件树路径 */
  path: string;
}

export interface ContourDifference {
  /** 最早出现状态差异的区间起止（以全音符为 1） */
  start: Frac;
  end: Frac;
  performance: { state: SoundState; path: string };
  reference: { state: SoundState; path: string };
}

export type ContourResult =
  | { kind: 'match' }
  | { kind: 'differ'; difference: ContourDifference };

export interface MeasureReport {
  /** 小节序号（从 1 开始，用于展示） */
  index: number;
  /** 演奏侧（measures）时值结果 */
  performance: SideReport;
  /** 参考侧（referenceMeasures）时值结果；未提供参考时为 null */
  reference: SideReport | null;
  /**
   * 两侧时值都正确时的发声轮廓比较结果；
   * 任一侧未填满或超出时为 null（此时只显示时值问题）。
   */
  contour: ContourResult | null;
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

/** 单侧（演奏 / 参考）一个小节的时值核算 */
function analyzeSide(measure: MeasureInput, expected: Frac, rootName: 'measures' | 'referenceMeasures', mi: number): SideReport {
  const actual = measure.events.reduce<Frac>((acc, e) => acc.add(eventDuration(e)), Frac.zero());
  const diff = actual.sub(expected);
  const sign = diff.sign();
  const status: MeasureStatus = sign === 0 ? 'ok' : sign < 0 ? 'short' : 'over';

  let overflowPath: string | null = null;
  if (status === 'over') {
    overflowPath = findFirstOverflow(
      measure.events,
      expected,
      Frac.zero(),
      Frac.of(1),
      `${rootName}[${mi}].events`,
    ).overflowPath;
  }

  return { expected, actual, diff, status, overflowPath };
}

/**
 * 将嵌套连音按沿途倍率（inTimeOf/actual 连乘）展开，得到叶事件的精确分数时间段。
 * 音符视为发声、休止符视为静音。相邻同状态片段不做合并（保留原事件树路径）。
 * 返回展开后该组事件末端的时间游标，供上层继续累加。
 */
function collectSegments(
  events: RhythmEvent[],
  scale: Frac,
  cursor: Frac,
  basePath: string,
  out: SoundSegment[],
): Frac {
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const path = `${basePath}[${i}]`;
    if (e.type === 'tuplet') {
      const innerScale = scale.mul(Frac.of(e.inTimeOf, e.actual));
      cursor = collectSegments(e.events, innerScale, cursor, `${path}.events`, out);
    } else {
      const dur = leafDuration(e).mul(scale);
      const start = cursor;
      cursor = cursor.add(dur);
      out.push({ start, end: cursor, state: e.type === 'note' ? 'sounding' : 'silent', path });
    }
  }
  return cursor;
}

/**
 * 合并相邻同状态片段（忽略等价的事件拆分）；合并区间沿用首个片段的路径。
 * 注意：合并片段的路径只用于表示整段来源；差异定位须另在叶片段中按时刻反查。
 */
function mergeSegments(raw: SoundSegment[]): SoundSegment[] {
  const merged: SoundSegment[] = [];
  for (const seg of raw) {
    const last = merged[merged.length - 1];
    if (last && last.end.cmp(seg.start) === 0 && last.state === seg.state) {
      merged[merged.length - 1] = { ...last, end: seg.end };
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

/** 在片段列表中定位覆盖时刻 t（t 落在 [start, end) 内）的片段 */
function segmentAt(segments: SoundSegment[], t: Frac): SoundSegment {
  for (const s of segments) {
    if (t.cmp(s.start) >= 0 && t.cmp(s.end) < 0) return s;
  }
  // 右侧边界（t == 整小节长度）时取最后一个片段
  return segments[segments.length - 1];
}

/**
 * 比较整小节发声区间：以两侧所有边界的并集切分时间轴，逐段比较状态，
 * 等价的事件拆分（边界位置相同但拆分不同）经合并后不影响结果。
 * 返回最早出现差异的区间及两侧状态、原事件树路径；无差异返回 match。
 */
function compareContours(
  perfMeasure: MeasureInput,
  refMeasure: MeasureInput,
  mi: number,
): ContourResult {
  const perfLeaves: SoundSegment[] = [];
  collectSegments(perfMeasure.events, Frac.of(1), Frac.zero(), `measures[${mi}].events`, perfLeaves);
  const refLeaves: SoundSegment[] = [];
  collectSegments(refMeasure.events, Frac.of(1), Frac.zero(), `referenceMeasures[${mi}].events`, refLeaves);

  // 合并相邻同状态片段后再取边界，使等价的事件拆分不产生差异
  const perfMerged = mergeSegments(perfLeaves);
  const refMerged = mergeSegments(refLeaves);

  // 两侧时值均已核算为应有时值，末端边界相同；取两侧边界并集并升序去重
  const boundarySet = new Set<string>();
  const map = new Map<string, Frac>();
  for (const s of [...perfMerged, ...refMerged]) {
    for (const t of [s.start, s.end]) {
      const key = `${t.num}/${t.den}`;
      boundarySet.add(key);
      map.set(key, t);
    }
  }
  const boundaries = [...boundarySet]
    .map((k) => map.get(k)!)
    .sort((a, b) => a.cmp(b));

  for (let i = 0; i + 1 < boundaries.length; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    const pMerged = segmentAt(perfMerged, start);
    const rMerged = segmentAt(refMerged, start);
    if (pMerged.state !== rMerged.state) {
      // 路径回到合并前的叶事件：报实际覆盖差异区间起点的原事件树路径
      const pLeaf = segmentAt(perfLeaves, start);
      const rLeaf = segmentAt(refLeaves, start);
      return {
        kind: 'differ',
        difference: {
          start,
          end,
          performance: { state: pLeaf.state, path: pLeaf.path },
          reference: { state: rLeaf.state, path: rLeaf.path },
        },
      };
    }
  }
  return { kind: 'match' };
}

/** 逐小节分析；调用前须保证 validateScore 无错误 */
export function analyze(score: ScoreInput): MeasureReport[] {
  const expected = Frac.of(score.timeSignature.numerator, score.timeSignature.denominator);
  const refs = score.referenceMeasures;

  return score.measures.map((m, mi) => {
    const performance = analyzeSide(m, expected, 'measures', mi);
    const reference = refs ? analyzeSide(refs[mi], expected, 'referenceMeasures', mi) : null;

    let contour: ContourResult | null = null;
    if (
      refs &&
      reference !== null &&
      performance.status === 'ok' &&
      reference.status === 'ok'
    ) {
      contour = compareContours(m, refs[mi], mi);
    }

    return { index: mi + 1, performance, reference, contour };
  });
}
