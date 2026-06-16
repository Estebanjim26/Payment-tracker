import { useState, useMemo } from "react";
import React from "react";

// ── helpers ────────────────────────────────────────────────────────────────
const fmt = (n: string | number): string =>
  "$" + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const parseDate = (s: string): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const fmtDate = (date: Date | null): string =>
  date
    ? date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
    : "";

const freqLabel = (w: string): string => {
  const n = parseInt(w) || 1;
  if (n === 1) return "Weekly";
  if (n === 2) return "Bi-Weekly";
  if (n === 4) return "Monthly";
  return `Every ${n} Weeks`;
};

const pad = (s: string | number | null | undefined, w: number, right = false): string => {
  const str = String(s ?? "");
  return right ? str.padStart(w) : str.padEnd(w);
};

const defaultFeeStart = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
};

// ── static styles ──────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: "#888",
  letterSpacing: "0.05em", textTransform: "uppercase",
  display: "flex", alignItems: "center", gap: 5, marginBottom: 4,
};

const baseInput: React.CSSProperties = {
  border: "1px solid #e0e0e0", borderRadius: 6, padding: "7px 10px",
  fontSize: 13, width: "100%", outline: "none", color: "#222",
  background: "#f8f8f8", boxSizing: "border-box",
  colorScheme: "light",
};

const prefixWrap: React.CSSProperties = {
  display: "flex", alignItems: "center", border: "1px solid #e0e0e0",
  borderRadius: 6, overflow: "hidden", background: "#f8f8f8",
};

const prefixSpan: React.CSSProperties = {
  padding: "7px 8px", color: "#999", fontSize: 13,
  borderRight: "1px solid #e0e0e0", background: "#f0f0f0", userSelect: "none",
};

const noBorderInput: React.CSSProperties = { ...baseInput, border: "none", borderRadius: 0, flex: 1 };

const typeColor: Record<string, string> = { DP: "#6c63ff", Payment: "#222", Final: "#16a34a", Monthly: "#d97706" };
const typeBg: Record<string, string>    = { DP: "#ede9fe", Payment: "transparent", Final: "#dcfce7", Monthly: "#fef3c7" };

const tooltips: Record<string, string> = {
  totalDebt:        "The full amount owed before any payments.",
  downPayment:      "An upfront lump sum paid immediately to reduce the balance.",
  downPaymentDate:  "The date the down payment is made.",
  paymentAmount:    "The fixed amount paid on each regular payment.",
  freqWeeks:        "How often payments are made, in weeks. E.g. 1 = weekly, 2 = bi-weekly.",
  firstPaymentDate: "The date the first regular payment is due.",
  monthlyBill:      "A recurring monthly charge that does not reduce the debt balance. Billed on the 1st of each month, starting next month.",
};

// ── InfoIcon ───────────────────────────────────────────────────────────────
function InfoIcon({ tip }: { tip: string }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 14, height: 14, borderRadius: "50%", background: "#d0d0d0",
        color: "#555", fontSize: 9, fontWeight: 700, cursor: "default",
        lineHeight: "1", userSelect: "none",
      }}>i</span>
      {show && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
          transform: "translateX(-50%)", background: "#333", color: "#fff",
          fontSize: 11, padding: "6px 10px", borderRadius: 6,
          maxWidth: 220, whiteSpace: "normal", lineHeight: "1.5", zIndex: 100,
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)", pointerEvents: "none",
        }}>
          {tip}
        </span>
      )}
    </span>
  );
}

// ── types ──────────────────────────────────────────────────────────────────
interface Row {
  date: Date;
  type: string;
  payment: number;
  balance: number;
  isDP?: boolean;
  isFee?: boolean;
  pmtNum?: number;
}

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [totalDebt,        setTotalDebt]        = useState("");
  const [downPayment,      setDownPayment]      = useState("");
  const [downPaymentDate,  setDownPaymentDate]  = useState("");
  const [paymentAmount,    setPaymentAmount]    = useState("");
  const [freqWeeks,        setFreqWeeks]        = useState("");
  const [firstPaymentDate, setFirstPaymentDate] = useState("");
  const [monthlyBill,      setMonthlyBill]      = useState("");
  const [copied,           setCopied]           = useState(false);

  const schedule = useMemo((): Row[] => {
    const total    = parseFloat(totalDebt)    || 0;
    const dp       = parseFloat(downPayment)  || 0;
    const dpDate   = parseDate(downPaymentDate);
    const pmt      = parseFloat(paymentAmount) || 0;
    const freqDays = (parseInt(freqWeeks) || 1) * 7;
    const firstPmt = parseDate(firstPaymentDate);
    const bill     = parseFloat(monthlyBill) || 0;

    if (!total || !dpDate || !firstPmt || !pmt) return [];

    const rows: Row[] = [];
    const balAfterDP = parseFloat(Math.max(0, total - dp).toFixed(2));
    rows.push({ date: dpDate, type: "DP", payment: dp, balance: balAfterDP, isDP: true });

    let bal = balAfterDP;
    let pmtDate = new Date(firstPmt);
    let pmtNum = 1;

    while (bal > 0 && pmtNum <= 1000) {
      const actual = parseFloat(Math.min(pmt, bal).toFixed(2));
      bal = parseFloat(Math.max(0, bal - actual).toFixed(2));
      rows.push({ date: new Date(pmtDate), type: bal === 0 ? "Final" : "Payment", payment: actual, balance: bal, pmtNum: pmtNum++ });
      if (bal === 0) break;
      pmtDate = addDays(pmtDate, freqDays);
    }

    if (bill > 0) {
      const endDate = rows[rows.length - 1].date;
      let feeDate = defaultFeeStart();
      while (feeDate <= endDate) {
        rows.push({ date: new Date(feeDate), type: "Monthly", payment: bill, balance: 0, isFee: true });
        feeDate = new Date(feeDate.getFullYear(), feeDate.getMonth() + 1, 1);
      }
    }

    const order: Record<string, number> = { DP: 0, Payment: 1, Final: 1, Monthly: 2 };
    rows.sort((a, b) => {
      const diff = a.date.getTime() - b.date.getTime();
      return diff !== 0 ? diff : (order[a.type] ?? 1) - (order[b.type] ?? 1);
    });

    let lastBal = total;
    for (const r of rows) {
      if (r.isFee) r.balance = lastBal;
      else lastBal = r.balance;
    }
    return rows;
  }, [totalDebt, downPayment, downPaymentDate, paymentAmount, freqWeeks, firstPaymentDate, monthlyBill]);

  const debtPayments = schedule.filter((r) => r.type === "Payment" || r.type === "Final");
  const payoffRow    = schedule.find((r) => r.type === "Final");
  const remaining    = Math.max(0, (parseFloat(totalDebt) || 0) - (parseFloat(downPayment) || 0));

  const handleCopy = () => {
    const summaryLines = [
      `Total Debt: ${fmt(totalDebt)}`,
      `Down Payment: ${fmt(downPayment)}`,
      `Remaining Balance After Down Payment: ${fmt(remaining)}`,
      `Payment Plan: ${fmt(paymentAmount)} ${freqLabel(freqWeeks)}`,
      "",
    ];
    const header  = `${pad("#", 4)} | ${pad("Date", 12)} | ${pad("Type", 8)} | ${pad("Payment", 10, true)} | ${pad("Balance", 12, true)}`;
    const divider = "-".repeat(header.length);
    const tableRows = schedule.map((r) => {
      const num = r.isDP ? "—" : r.isFee ? "" : String(r.pmtNum);
      return `${pad(num, 4)} | ${pad(fmtDate(r.date), 12)} | ${pad(r.type, 8)} | ${pad(fmt(r.payment), 10, true)} | ${pad(fmt(r.balance), 12, true)}`;
    });
    const footer = ["", `Total Payments: ${debtPayments.length}`, `Estimated Payoff Date: ${payoffRow ? fmtDate(payoffRow.date) : "—"}`];
    const text = [...summaryLines, header, divider, ...tableRows, ...footer].join("\n");

    navigator.clipboard.writeText(text)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.focus(); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta);
        setCopied(true); setTimeout(() => setCopied(false), 2000);
      });
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", maxWidth: 960, margin: "0 auto", padding: "40px 48px", color: "#222", minWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>💳 Payment Scheduler</h1>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>Fill in your details to generate a full payment schedule.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28, padding: 24, background: "#fafafa", border: "1px dashed #d0d0d0", borderRadius: 10 }}>
        <div><label style={labelStyle}>Total Debt <InfoIcon tip={tooltips.totalDebt} /></label>
          <div style={prefixWrap}><span style={prefixSpan}>$</span>
            <input style={noBorderInput} placeholder="e.g. 5000" value={totalDebt} onChange={e => setTotalDebt(e.target.value)} />
          </div></div>

        <div><label style={labelStyle}>Down Payment <InfoIcon tip={tooltips.downPayment} /></label>
          <div style={prefixWrap}><span style={prefixSpan}>$</span>
            <input style={noBorderInput} placeholder="e.g. 500" value={downPayment} onChange={e => setDownPayment(e.target.value)} />
          </div></div>

        <div><label style={labelStyle}>Down Payment Date <InfoIcon tip={tooltips.downPaymentDate} /></label>
          <div style={{ position: "relative" }}>
            <input type="date" style={{ ...baseInput, paddingRight: 36 }} value={downPaymentDate} onChange={e => setDownPaymentDate(e.target.value)} />
            <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>📅</span>
          </div></div>

        <div><label style={labelStyle}>Payment Amount <InfoIcon tip={tooltips.paymentAmount} /></label>
          <div style={prefixWrap}><span style={prefixSpan}>$</span>
            <input style={noBorderInput} placeholder="e.g. 200" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
          </div></div>

        <div><label style={labelStyle}>Frequency (weeks) <InfoIcon tip={tooltips.freqWeeks} /></label>
          <input style={baseInput} placeholder="e.g. 2" value={freqWeeks} onChange={e => setFreqWeeks(e.target.value)} /></div>

        <div><label style={labelStyle}>First Payment Date <InfoIcon tip={tooltips.firstPaymentDate} /></label>
          <div style={{ position: "relative" }}>
            <input type="date" style={{ ...baseInput, paddingRight: 36 }} value={firstPaymentDate} onChange={e => setFirstPaymentDate(e.target.value)} />
            <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>📅</span>
          </div></div>

        <div><label style={labelStyle}>Monthly Bill <InfoIcon tip={tooltips.monthlyBill} /></label>
          <div style={prefixWrap}><span style={prefixSpan}>$</span>
            <input style={noBorderInput} placeholder="e.g. 25 (optional)" value={monthlyBill} onChange={e => setMonthlyBill(e.target.value)} />
          </div></div>
      </div>

      {schedule.length > 0 && (
        <>
          <div style={{ fontFamily: "monospace", fontSize: 13, padding: "14px 18px", background: "#fafafa", border: "1px dashed #bbb", borderRadius: 8, marginBottom: 16, lineHeight: "2.1", color: "#444" }}>
            <div>· Total Debt: <strong>{fmt(totalDebt)}</strong></div>
            <div>· Down Payment: <strong>{fmt(downPayment)}</strong></div>
            <div>· Remaining Balance After Down Payment: <strong>{fmt(remaining)}</strong></div>
            <div>· Payment Plan: <strong>{fmt(paymentAmount)}</strong> <strong>{freqLabel(freqWeeks)}</strong></div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button onClick={handleCopy} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 7, border: "1px solid #d0d0d0", background: copied ? "#dcfce7" : "#fff", color: copied ? "#16a34a" : "#444", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background 0.2s, color 0.2s" }}>
              {copied ? "✓ Copied!" : "📋 Copy Schedule"}
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #222" }}>
                  {([ ["#","center"], ["Date","left"], ["Type","center"], ["Payment","right"], ["Balance","right"] ] as [string,string][]).map(([h, align]) => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: align as React.CSSProperties["textAlign"], fontWeight: 700, fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", color: "#555" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedule.map((r, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "7px 12px", textAlign: "center", color: "#aaa", fontSize: 12 }}>{r.isDP ? "—" : r.isFee ? "" : r.pmtNum}</td>
                    <td style={{ padding: "7px 12px", color: "#444" }}>{fmtDate(r.date)}</td>
                    <td style={{ padding: "7px 12px", textAlign: "center" }}>
                      <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, color: typeColor[r.type], background: typeBg[r.type], letterSpacing: "0.04em" }}>{r.type}</span>
                    </td>
                    <td style={{ padding: "7px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: r.type === "Final" ? 700 : 400 }}>{fmt(r.payment)}</td>
                    <td style={{ padding: "7px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: r.balance === 0 ? "#16a34a" : "#222", fontWeight: r.balance === 0 ? 700 : 400 }}>{fmt(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 20, padding: "14px 18px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, display: "flex", gap: 40, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Total Payments</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#15803d" }}>{debtPayments.length}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Estimated Payoff Date</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#15803d" }}>{payoffRow ? fmtDate(payoffRow.date) : "—"}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}