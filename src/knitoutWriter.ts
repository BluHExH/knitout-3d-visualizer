/**
 * Browser-side Knitout Writer (subset of textiles-lab/knitout-frontend-js).
 * Generates knitout-2 text from a simple imperative API.
 */
export type WriterOptions = {
  carriers?: string[]
  version?: string
}

export class KnitoutWriter {
  private lines: string[] = []
  private carriers: string[]
  private headers: Record<string, string> = {}

  constructor(opts: WriterOptions = {}) {
    this.carriers = (opts.carriers || ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']).map(String)
    const ver = opts.version || '2'
    this.lines.push(';!knitout-' + ver)
    this.lines.push(';;Carriers: ' + this.carriers.join(' '))
  }

  addHeader(name: string, value: string) {
    this.headers[name] = value
    this.lines.push(';;' + name + ': ' + value)
    return this
  }

  private carriersArg(c: string | string[]): string {
    return Array.isArray(c) ? c.join(' ') : String(c)
  }

  in(carriers: string | string[]) {
    this.lines.push('in ' + this.carriersArg(carriers))
    return this
  }
  inhook(carriers: string | string[]) {
    this.lines.push('inhook ' + this.carriersArg(carriers))
    return this
  }
  releasehook(carriers: string | string[]) {
    this.lines.push('releasehook ' + this.carriersArg(carriers))
    return this
  }
  out(carriers: string | string[]) {
    this.lines.push('out ' + this.carriersArg(carriers))
    return this
  }
  outhook(carriers: string | string[]) {
    this.lines.push('outhook ' + this.carriersArg(carriers))
    return this
  }

  tuck(dir: '+' | '-', needle: string, carriers: string | string[]) {
    this.lines.push('tuck ' + dir + ' ' + needle + ' ' + this.carriersArg(carriers))
    return this
  }
  knit(dir: '+' | '-', needle: string, carriers: string | string[]) {
    this.lines.push('knit ' + dir + ' ' + needle + ' ' + this.carriersArg(carriers))
    return this
  }
  miss(dir: '+' | '-', needle: string, carriers?: string | string[]) {
    if (carriers !== undefined) {
      this.lines.push('miss ' + dir + ' ' + needle + ' ' + this.carriersArg(carriers))
    } else {
      this.lines.push('miss ' + dir + ' ' + needle)
    }
    return this
  }
  split(dir: '+' | '-', from: string, to: string, carriers: string | string[]) {
    this.lines.push('split ' + dir + ' ' + from + ' ' + to + ' ' + this.carriersArg(carriers))
    return this
  }
  drop(needle: string) {
    this.lines.push('drop ' + needle)
    return this
  }
  amiss(needle: string) {
    this.lines.push('amiss ' + needle)
    return this
  }
  xfer(from: string, to: string) {
    this.lines.push('xfer ' + from + ' ' + to)
    return this
  }
  rack(racks: number | string) {
    this.lines.push('rack ' + String(racks))
    return this
  }

  raw(line: string) {
    this.lines.push(line)
    return this
  }

  comment(text: string) {
    this.lines.push('; ' + text)
    return this
  }

  write(_path?: string): string {
    return this.lines.join('\n') + '\n'
  }
}

export type CompileResult =
  | { ok: true; knitout: string }
  | { ok: false; error: string }

/**
 * Run user JavaScript that uses `knitout.Writer`.
 * Must end with: return k.write()
 */
export function compileKnitoutJs(source: string): CompileResult {
  try {
    const knitoutApi = { Writer: KnitoutWriter }

    const body = [
      '"use strict";',
      'var __logs = [];',
      'var console = {',
      '  log: function() { __logs.push(Array.prototype.slice.call(arguments).map(String).join(" ")); },',
      '  warn: function() { __logs.push(Array.prototype.slice.call(arguments).map(String).join(" ")); },',
      '  error: function() { __logs.push(Array.prototype.slice.call(arguments).map(String).join(" ")); }',
      '};',
      'var __result = (function(knitout) {',
      source,
      '})(knitout);',
      'if (typeof __result === "string" && (__result.indexOf("knitout") !== -1 || __result.indexOf("knit ") !== -1)) return __result;',
      'if (__result && typeof __result.write === "function") return __result.write();',
      'if (__logs.length) {',
      '  var joined = __logs.join("\\n");',
      '  if (joined.indexOf(";!knitout") !== -1 || joined.indexOf("knit ") !== -1) return joined + "\\n";',
      '}',
      'throw new Error("JS must create knitout.Writer, call ops, then return k.write()");',
    ].join('\n')

    const fn = new Function('knitout', body)
    const out = fn(knitoutApi) as string

    if (!out || typeof out !== 'string') {
      return { ok: false, error: 'Writer produced empty output' }
    }

    let text = out.trim() + '\n'
    if (text.indexOf(';!knitout') !== 0) {
      text = ';!knitout-2\n;;Carriers: 1 2 3 4 5 6 7 8 9 10\n' + text
    }
    return { ok: true, knitout: text }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}
