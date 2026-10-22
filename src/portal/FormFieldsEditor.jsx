/* Editor de campos do formulário de captura — um cartão por campo: rótulo, tipo, obrigatório,
   subir/descer, remover; múltipla escolha com editor de opções. Só tela: quem valida e gera as
   chaves é buildFields (formBuilderKit.js). */
import { FaPlus, FaArrowUp, FaArrowDown, FaTrashCan, FaXmark, FaSignature, FaWandMagicSparkles } from "react-icons/fa6";
import { FIELD_TYPES, blankField, TEMPLATES } from "./formBuilderKit.js";

const inputCls = "w-full rounded-xl2 border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-g-word placeholder:text-g-muted/60 focus:border-g-gold/50 focus:outline-none";
const iconBtn = "grid place-items-center h-8 w-8 rounded-full border border-white/12 bg-white/[0.03] text-g-muted hover:text-g-word hover:border-white/25 transition disabled:opacity-30 disabled:pointer-events-none";

const move = (arr, i, d) => {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const a = arr.slice();
  [a[i], a[j]] = [a[j], a[i]];
  return a;
};

export default function FormFieldsEditor({ fields, onChange, L, onTemplate }) {
  const sigIdx = fields.findIndex((f) => f.type === "signature");
  const set = (i, patch) => onChange(fields.map((f, k) => (k === i ? { ...f, ...patch } : f)));
  const setType = (i, type) => {
    const f = fields[i];
    const patch = { type };
    if (type === "select" && !(f.options || []).length) patch.options = ["", ""];
    if (type === "signature") patch.required = true;
    set(i, patch);
  };
  const setOpt = (i, j, v) => set(i, { options: fields[i].options.map((o, k) => (k === j ? v : o)) });
  const full = fields.length >= 30;

  return (
    <div className="space-y-3">
      {/* modelos */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-bold text-g-muted inline-flex items-center gap-1.5"><FaWandMagicSparkles size={10} /> {L.templates}</span>
        {[["spa", L.tplSpa], ["medspa", L.tplMed]].map(([k, name]) => (
          <button key={k} type="button" onClick={() => onTemplate(k, name, TEMPLATES[k](L))}
            className="rounded-full border border-g-gold/35 bg-g-gold/10 px-3 py-1.5 text-[11px] font-bold text-g-word hover:bg-g-gold/20 transition">{name}</button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold text-g-muted">{L.fields} · {fields.length}/30</div>
      </div>
      <p className="text-[11px] text-g-muted/80 -mt-2">{L.contactNote}</p>

      {fields.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-white/12 px-4 py-4 text-[12px] text-g-muted text-center">{L.noFields}</div>
      ) : (
        <ol className="space-y-2">
          {fields.map((f, i) => (
            <li key={f.uid} className="rounded-xl2 border border-white/10 bg-white/[0.03] p-3 space-y-2">
              <div className="flex items-start gap-2 flex-wrap sm:flex-nowrap">
                <span className="mt-2 text-[10px] font-black text-g-muted/70 w-5 shrink-0 text-right">{i + 1}</span>
                <input value={f.label} onChange={(e) => set(i, { label: e.target.value })} placeholder={L.labelPh} maxLength={120}
                  aria-label={L.labelPh} className={`${inputCls} flex-1 min-w-[180px]`} />
                <select value={f.type} onChange={(e) => setType(i, e.target.value)} aria-label={L.type}
                  className="rounded-xl2 border border-white/12 bg-[#1c1b19] px-2.5 py-2 text-[12px] text-g-word focus:border-g-gold/50 focus:outline-none [color-scheme:dark] shrink-0">
                  {FIELD_TYPES.map((t) => {
                    const taken = t === "signature" && sigIdx !== -1 && sigIdx !== i;
                    return <option key={t} value={t} disabled={taken}>{L[`t_${t}`]}{taken ? ` ${L.sigTaken}` : ""}</option>;
                  })}
                </select>
              </div>

              {f.type === "select" && (
                <div className="ml-7 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-g-muted">{L.options}</div>
                  {(f.options || []).map((o, j) => (
                    <div key={j} className="flex items-center gap-1.5">
                      <input value={o} onChange={(e) => setOpt(i, j, e.target.value)} placeholder={`${L.optionPh} ${j + 1}`} maxLength={120}
                        aria-label={`${L.optionPh} ${j + 1}`} className={`${inputCls} py-1.5 text-[13px]`} />
                      <button type="button" title={L.moveUp} aria-label={L.moveUp} disabled={j === 0} onClick={() => set(i, { options: move(f.options, j, -1) })} className={iconBtn}><FaArrowUp size={9} /></button>
                      <button type="button" title={L.moveDown} aria-label={L.moveDown} disabled={j === f.options.length - 1} onClick={() => set(i, { options: move(f.options, j, 1) })} className={iconBtn}><FaArrowDown size={9} /></button>
                      <button type="button" title={L.removeOption} aria-label={L.removeOption} onClick={() => set(i, { options: f.options.filter((_, k) => k !== j) })} className={iconBtn}><FaXmark size={10} /></button>
                    </div>
                  ))}
                  <button type="button" disabled={(f.options || []).length >= 30} onClick={() => set(i, { options: [...(f.options || []), ""] })}
                    className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-bold text-g-muted hover:text-g-word transition disabled:opacity-40"><FaPlus size={8} /> {L.addOption}</button>
                </div>
              )}
              {f.type === "signature" && <p className="ml-7 text-[11px] text-g-muted inline-flex items-center gap-1.5"><FaSignature size={11} /> {L.sigNote}</p>}
              {f.type === "checkbox" && <p className="ml-7 text-[11px] text-g-muted">{L.checkboxNote}</p>}

              <div className="ml-7 flex items-center gap-2 flex-wrap">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none text-[11px] font-bold text-g-muted">
                  <input type="checkbox" checked={!!f.required} onChange={(e) => set(i, { required: e.target.checked })} className="h-4 w-4 accent-[#FFC23D]" />
                  <span className={f.required ? "text-g-word" : ""}>{L.required}</span>
                </label>
                <span className="flex-1" />
                <button type="button" title={L.moveUp} aria-label={L.moveUp} disabled={i === 0} onClick={() => onChange(move(fields, i, -1))} className={iconBtn}><FaArrowUp size={10} /></button>
                <button type="button" title={L.moveDown} aria-label={L.moveDown} disabled={i === fields.length - 1} onClick={() => onChange(move(fields, i, 1))} className={iconBtn}><FaArrowDown size={10} /></button>
                <button type="button" title={L.remove} aria-label={L.remove} onClick={() => onChange(fields.filter((_, k) => k !== i))} className={`${iconBtn} hover:text-[#e0855f] hover:border-[#e0855f]/40`}><FaTrashCan size={10} /></button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <button type="button" disabled={full} onClick={() => onChange([...fields, blankField("text")])}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-g-muted hover:text-g-word transition disabled:opacity-40">
        <FaPlus size={9} /> {L.addField}
      </button>
    </div>
  );
}
