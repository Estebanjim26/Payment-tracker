import { useState, useMemo } from "react";
import React from "react";

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
  date ? date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }) : "";

const freqLabel = (w: string): string => {
  if (w === "monthly") return "Monthly (1st of month)";
  const n = parseInt(w) || 1;
  if (n === 1) return "Weekly";
  if (n === 2) return "Bi-Weekly";
  return `Every ${n} Weeks`;
};

const pad = (s: string | number | null | undefined, w: number, right = false): string => {
  const str = String(s ?? "");
  return right ? str.padStart(w) : str.padEnd(w);
};

const firstBusinessDay = (year: number, month: number): Date => {
  const d = new Date(year, month, 1);
  const day = d.getDay(); // 0=Sun, 6=Sat
  if (day === 0) d.setDate(2); // Sun → Mon
  if (day === 6) d.setDate(3); // Sat → Mon
  return d;
};

const defaultFeeStart = (): Date => {
  const now = new Date();
  return firstBusinessDay(now.getFullYear(), now.getMonth() + 1);
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: "#888",
  letterSpacing: "0.05em", textTransform: "uppercase",
  display: "flex", alignItems: "center", gap: 5, marginBottom: 4,
};

const baseInput: React.CSSProperties = {
  border: "1px solid #e0e0e0", borderRadius: 6, padding: "7px 10px",
  fontSize: 13, width: "100%", outline: "none", color: "#222",
  background: "#f8f8f8", boxSizing: "border-box", colorScheme: "light" as const,
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
const typeBg: Record<string, string> = { DP: "#ede9fe", Payment: "transparent", Final: "#dcfce7", Monthly: "#fef3c7" };

const tooltips: Record<string, string> = {
  totalDebt: "The full amount owed before any payments.",
  downPayment: "An upfront lump sum paid immediately to reduce the balance.",
  downPaymentDate: "The date the down payment is made.",
  paymentAmount: "The fixed amount paid on each regular payment.",
  freqWeeks: "How often payments are made. Monthly = 1st of each month.",
  firstPaymentDate: "The date the first regular payment is due.",
  monthlyBill: "A recurring monthly charge that does not reduce the debt balance. Billed on the 1st of each month, starting next month.",
};

function InfoIcon({ tip }: { tip: string }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 14, height: 14, borderRadius: "50%", background: "#d0d0d0", color: "#555", fontSize: 9, fontWeight: 700, cursor: "default", lineHeight: "1", userSelect: "none" }}>i</span>
      {show && (
        <span style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", background: "#333", color: "#fff", fontSize: 11, padding: "6px 10px", borderRadius: 6, maxWidth: 220, whiteSpace: "normal", lineHeight: "1.5", zIndex: 100, boxShadow: "0 2px 8px rgba(0,0,0,0.2)", pointerEvents: "none" }}>
          {tip}
        </span>
      )}
    </span>
  );
}

interface Row {
  date: Date;
  type: string;
  payment: number;
  balance: number;
  isDP?: boolean;
  isFee?: boolean;
  pmtNum?: number;
}

export default function App() {
  const [totalDebt, setTotalDebt] = useState("");
  const [useDownPayment, setUseDownPayment] = useState(true);
  const [downPayment, setDownPayment] = useState("");
  const [downPaymentDate, setDownPaymentDate] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [freqWeeks, setFreqWeeks] = useState("");
  const [firstPaymentDate, setFirstPaymentDate] = useState("");
  const [monthlyBill, setMonthlyBill] = useState("");
  const [copied, setCopied] = useState(false);

  const schedule = useMemo((): Row[] => {
    const total = parseFloat(totalDebt) || 0;
    const dp = useDownPayment ? (parseFloat(downPayment) || 0) : 0;
    const dpDate = useDownPayment ? parseDate(downPaymentDate) : new Date(0);
    const pmt = parseFloat(paymentAmount) || 0;
    const firstPmt = parseDate(firstPaymentDate);
    const bill = parseFloat(monthlyBill) || 0;
    const isMonthlyFreq = freqWeeks === "monthly";
    const freqDays = isMonthlyFreq ? 0 : (parseInt(freqWeeks) || 1) * 7;

    if (!total || !firstPmt || !pmt) return [];
    if (useDownPayment && !parseDate(downPaymentDate)) return [];

    const rows: Row[] = [];
    const balAfterDP = parseFloat(Math.max(0, total - dp).toFixed(2));
    if (useDownPayment && dp > 0 && dpDate) {
      rows.push({ date: dpDate, type: "DP", payment: dp, balance: balAfterDP, isDP: true });
    }

    let bal = balAfterDP;
    let pmtDate = new Date(firstPmt);
    if (isMonthlyFreq) {
      pmtDate = firstBusinessDay(firstPmt.getFullYear(), firstPmt.getMonth());
      const refDate = (useDownPayment && dpDate) ? dpDate : new Date(0);
      if (pmtDate <= refDate) {
        pmtDate = firstBusinessDay(pmtDate.getFullYear(), pmtDate.getMonth() + 1);
      }
    }
    let pmtNum = 1;

    while (bal > 0 && pmtNum <= 1000) {
      const actual = parseFloat(Math.min(pmt, bal).toFixed(2));
      bal = parseFloat(Math.max(0, bal - actual).toFixed(2));
      rows.push({ date: new Date(pmtDate), type: bal === 0 ? "Final" : "Payment", payment: actual, balance: bal, pmtNum: pmtNum++ });
      if (bal === 0) break;
      if (isMonthlyFreq) {
        pmtDate = firstBusinessDay(pmtDate.getFullYear(), pmtDate.getMonth() + 1);
      } else {
        pmtDate = addDays(pmtDate, freqDays);
      }
    }

    if (bill > 0) {
      const endDate = rows[rows.length - 1].date;
      let feeDate = defaultFeeStart();
      while (feeDate <= endDate) {
        rows.push({ date: new Date(feeDate), type: "Monthly", payment: bill, balance: 0, isFee: true });
        feeDate = firstBusinessDay(feeDate.getFullYear(), feeDate.getMonth() + 1);
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
  const payoffRow = schedule.find((r) => r.type === "Final");
  const remaining = Math.max(0, (parseFloat(totalDebt) || 0) - (useDownPayment ? (parseFloat(downPayment) || 0) : 0));

  const handleCopy = () => {
    const summaryLines = [
      `Total Debt: ${fmt(totalDebt)}`,
      `Down Payment: ${fmt(downPayment)}`,
      `Remaining Balance After Down Payment: ${fmt(remaining)}`,
      `Payment Plan: ${fmt(paymentAmount)} ${freqLabel(freqWeeks)}`,
      "",
    ];
    const header = `${pad("#", 4)} | ${pad("Date", 12)} | ${pad("Type", 8)} | ${pad("Payment", 10, true)} | ${pad("Balance", 12, true)}`;
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

  const handleReset = () => {
    setTotalDebt(""); setUseDownPayment(true); setDownPayment(""); setDownPaymentDate("");
    setPaymentAmount(""); setFreqWeeks(""); setFirstPaymentDate(""); setMonthlyBill("");
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", maxWidth: 960, margin: "0 auto", padding: "40px 48px", color: "#222", minWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>💳 Payment Schedule Tracker</h1>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>Fill in your details to generate a full payment schedule.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28, padding: 24, background: "#fafafa", border: "1px dashed #d0d0d0", borderRadius: 10 }}>
        <div><label style={labelStyle}>Total Debt <InfoIcon tip={tooltips.totalDebt} /></label>
          <div style={prefixWrap}><span style={prefixSpan}>$</span>
            <input style={noBorderInput} placeholder="e.g. 5,000" value={totalDebt} onChange={e => setTotalDebt(e.target.value)} />
          </div></div>

        <div>
          <label style={labelStyle}>
            Down Payment <InfoIcon tip={tooltips.downPayment} />
            <span
              onClick={() => setUseDownPayment(p => !p)}
              style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 11, fontWeight: 600, color: useDownPayment ? "#16a34a" : "#aaa", textTransform: "none", letterSpacing: 0 }}
            >
              <span style={{ width: 28, height: 15, borderRadius: 10, background: useDownPayment ? "#16a34a" : "#ccc", position: "relative", display: "inline-block", transition: "background 0.2s" }}>
                <span style={{ position: "absolute", top: 2, left: useDownPayment ? 15 : 2, width: 11, height: 11, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
              </span>
              {useDownPayment ? "On" : "Off"}
            </span>
          </label>
          <div style={{ ...prefixWrap, opacity: useDownPayment ? 1 : 0.4, pointerEvents: useDownPayment ? "auto" : "none" }}>
            <span style={prefixSpan}>$</span>
            <input style={noBorderInput} placeholder="e.g. 500" value={downPayment} onChange={e => setDownPayment(e.target.value)} disabled={!useDownPayment} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Down Payment Date <InfoIcon tip={tooltips.downPaymentDate} /></label>
          <div style={{ position: "relative", opacity: useDownPayment ? 1 : 0.4, pointerEvents: useDownPayment ? "auto" : "none" }}>
            <input type="date" style={{ ...baseInput, paddingRight: 36 }} value={downPaymentDate} onChange={e => setDownPaymentDate(e.target.value)} disabled={!useDownPayment} />
            <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>📅</span>
          </div>
        </div>

        <div><label style={labelStyle}>Payment Amount <InfoIcon tip={tooltips.paymentAmount} /></label>
          <div style={prefixWrap}><span style={prefixSpan}>$</span>
            <input style={noBorderInput} placeholder="e.g. 200" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
          </div></div>

        <div><label style={labelStyle}>Frequency <InfoIcon tip={tooltips.freqWeeks} /></label>
          <select style={{ ...baseInput, cursor: "pointer" }} value={freqWeeks} onChange={e => setFreqWeeks(e.target.value)}>
            <option value="">-- Select --</option>
            <option value="1">Weekly</option>
            <option value="2">Bi-Weekly</option>
            <option value="3">Every 3 Weeks</option>
            <option value="monthly">Monthly (1st of month)</option>
          </select></div>

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
            {useDownPayment && <div>· Down Payment: <strong>{fmt(downPayment)}</strong></div>}
            {useDownPayment && <div>· Remaining Balance After Down Payment: <strong>{fmt(remaining)}</strong></div>}
            <div>· Payment Plan: <strong>{fmt(paymentAmount)}</strong> <strong>{freqLabel(freqWeeks)}</strong></div>
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

          <div style={{ marginTop: 20, padding: "14px 18px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", gap: 40 }}>
              <div>
                <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Total Payments</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#15803d" }}>{debtPayments.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Estimated Payoff Date</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#15803d" }}>{payoffRow ? fmtDate(payoffRow.date) : "—"}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleReset} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 7, border: "1px solid #fca5a5", background: "#fff", color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                🗑️ Reset All
              </button>
              <button onClick={handleCopy} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 7, border: "1px solid #d0d0d0", background: copied ? "#dcfce7" : "#fff", color: copied ? "#16a34a" : "#444", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background 0.2s, color 0.2s" }}>
                {copied ? "✓ Copied!" : "📋 Copy Schedule"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
