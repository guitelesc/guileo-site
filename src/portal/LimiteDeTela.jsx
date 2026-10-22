// LimiteDeTela — uma tela que quebra não derruba a Central inteira.
//
// O DEFEITO (auditoria 2026-09-28): o único ErrorBoundary ficava no App. Qualquer erro de
// renderização em qualquer uma das ~60 telas trocava a Central TODA pela página de erro — menu
// lateral incluído. E o botão "Recarregar" recarregava a mesma URL com `?tab=<tela quebrada>`:
// quebrava de novo. A única saída era editar o endereço à mão. Para quem paga, isso é "o
// sistema caiu".
//
// Aqui o limite fica DENTRO da Central, em volta só do conteúdo. O menu continua vivo, e o botão
// leva a um lugar que funciona. Quem usa passa `key={view}`: trocar de tela zera o estado de erro.
import { Component } from "react";
import { captureError } from "../lib/monitoring.js";

export default class LimiteDeTela extends Component {
  constructor(props) { super(props); this.state = { quebrou: false }; }
  static getDerivedStateFromError() { return { quebrou: true }; }
  componentDidCatch(err, info) {
    try { captureError(err, { componentStack: info?.componentStack, tela: this.props.tela || "" }); } catch { /* monitor nunca derruba */ }
  }
  render() {
    if (!this.state.quebrou) return this.props.children;
    const { titulo, texto, rotulo, onVoltar } = this.props;
    return (
      <div role="alert" className="mx-auto max-w-md rounded-xl2 border border-g-gold/30 bg-g-gold/[0.06] p-7 text-center">
        <div className="text-3xl" aria-hidden>🌱</div>
        <div className="mt-2 text-[16px] font-extrabold text-g-word">{titulo}</div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-g-muted">{texto}</p>
        <button onClick={onVoltar} className="btn-bright text-sm mt-5">{rotulo}</button>
      </div>
    );
  }
}
