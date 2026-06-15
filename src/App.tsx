import { useState, useMemo } from "react";

const fmt = (n) =>
  "$" + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const parseDate = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const fmtDate = (date) =>
  date
    ? date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
    : "";

const freqLabel = (w) => {
  const n = parseInt(w) || 1;
  if (n === 1) return "Weekly";
  if (n === 2) return "Bi-Weekly";
  if (n === 4) return "Monthly";
  return `Every ${n} Weeks`;
};

const pad = (s, w, right = false) => {
  const str = String(s ?? "");
  return right ? str.padStart(w) : str.padEnd(w);
};

const defaultFeeStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
};

const labelStyle = {
  fontSize: 11, fontWeight: 600, color: "#888",
  letterSpacing: "0.05em", textTransform: "uppercase",
  display: "flex", alignItems: "center", gap: 5, marginBottom: 4,
};

const baseInput = {
  border: "1px solid #e0e0e0", borderRadius: 6, padding: "7px 10px",
  fontSize: 13, width: "100%", outline: "none", color: "#222",
  background: "#f8f8f8", boxSizing: "border-box",
};

const prefixWrap = {
  display: "flex", alignItems: "center", border: "1px solid #e0e0e0",
  borderRadius: 6, overflow: "hidden", background: "#f8f8f8",
};

const prefixSpan = {
  padding: "7px 8px", color: "#999", fontSize: 13,
  borderRight: "1px solid #e0e0e0", background: "#f0f0f0", userSelect: "none",
};

const noBorderInput = { ...baseInput, border: "none", borderRadius: 0, flex: 1 };

const typeColor = { DP: "#6c63ff", Payment: "#222", Final: "#16a34a", Monthly: "#d97706" };
const typeBg    = { DP: "#ede9fe", Payment: "transparent", Final: "#dcfce7", Monthly: "#fef3c7" };

const tooltips = {
  totalDebt:        "The full amount owed before any payments.",
  downPayment:      "An upfront lump sum paid immediately to reduce the balance.",
  downPaymentDate:  "The date the down payment is made.",
  paymentAmount:    "The fixed amount paid on each regular payment.",
  freqWeeks:        "How often payments are made, in weeks. E.g. 1 = weekly, 2 = bi-weekly.",
  firstPaymentDate: "The date the first regular payment is due.",
  monthlyBill:      "A recurring monthly charge that does not reduce the debt balance. Billed on the 1st of each month, starting next month.",
};

function InfoIcon({ tip }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      i
      {show && (
        
          {tip}
        
      )}
    
  );
}

export default function App() {
  const [totalDebt,        setTotalDebt]        = useState("");
  const [downPayment,      setDownPayment]      = useState("");
  const [downPaymentDate,  setDownPaymentDate]  = useState("");
  const [paymentAmount,    setPaymentAmount]    = useState("");
  const [freqWeeks,        setFreqWeeks]        = useState("");
  const [firstPaymentDate, setFirstPaymentDate] = useState("");
  const [monthlyBill,      setMonthlyBill]      = useState("");
  const [copied,           setCopied]           = useState(false);

  const schedule = useMemo(() => {
    const total    = parseFloat(totalDebt)    || 0;
    const dp       = parseFloat(downPayment)  || 0;
    const dpDate   = parseDate(downPaymentDate);
    const pmt      = parseFloat(paymentAmount) || 0;
    const freqDays = (parseInt(freqWeeks) || 1) * 7;
    const firstPmt = parseDate(firstPaymentDate);
    const bill     = parseFloat(monthlyBill) || 0;

    if (!total || !dpDate || !firstPmt || !pmt) return [];

    const rows = [];
    const balAfterDP = parseFloat(Math.max(0, total - dp).toFixed(2));
    rows.push({ date: dpDate, type: "DP", payment: dp, balance: balAfterDP, isDP: true });

    let bal = balAfterDP;
    let pmtDate = new Date(firstPmt);
    let pmtNum = 1;

    while (bal > 0 && pmtNum <= 1000) {
      const actual = parseFloat(Math.min(pmt, bal).toFixed(2));
      bal = parseFloat(Math.max(0, bal - actual).toFixed(2));
      rows.push({
        date: new Date(pmtDate),
        type: bal === 0 ? "Final" : "Payment",
        payment: actual, balance: bal, pmtNum: pmtNum++,
      });
      if (bal === 0) break;
      pmtDate = addDays(pmtDate, freqDays);
    }

    if (bill > 0) {
      const endDate = rows[rows.length - 1].date;
      let feeDate = defaultFeeStart();
      while (feeDate <= endDate) {
        rows.push({ date: new Date(feeDate), type: "Monthly", payment: bill, balance: null, isFee: true });
        feeDate = new Date(feeDate.getFullYear(), feeDate.getMonth() + 1, 1);
      }
    }

    const order = { DP: 0, Payment: 1, Final: 1, Monthly: 2 };
    rows.sort((a, b) => {
      const diff = a.date - b.date;
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
    
      💳 Payment Schedule Tracker
      Fill in your details to generate a full payment schedule.

      
        Total Debt 
          $
            <input style={noBorderInput} placeholder="e.g. 5000" value={totalDebt} onChange={e => setTotalDebt(e.target.value)} />
          

        Down Payment 
          $
            <input style={noBorderInput} placeholder="e.g. 500" value={downPayment} onChange={e => setDownPayment(e.target.value)} />
          

        Down Payment Date 
          <input type="date" style={baseInput} value={downPaymentDate} onChange={e => setDownPaymentDate(e.target.value)} />

        Payment Amount 
          $
            <input style={noBorderInput} placeholder="e.g. 200" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
          

        Frequency (weeks) 
          <input style={baseInput} placeholder="e.g. 2" value={freqWeeks} onChange={e => setFreqWeeks(e.target.value)} />

        First Payment Date 
          <input type="date" style={baseInput} value={firstPaymentDate} onChange={e => setFirstPaymentDate(e.target.value)} />

        Monthly Bill 
          $
            <input style={noBorderInput} placeholder="e.g. 25 (optional)" value={monthlyBill} onChange={e => setMonthlyBill(e.target.value)} />
          
      

      {schedule.length > 0 && (<>
        
          · Total Debt: {fmt(totalDebt)}
          · Down Payment: {fmt(downPayment)}
          · Remaining Balance After Down Payment: {fmt(remaining)}
          · Payment Plan: {fmt(paymentAmount)} {freqLabel(freqWeeks)}
        

        
          
            {copied ? "✓ Copied!" : "📋 Copy Schedule"}
          
        

        
          
            
              
                {[["#","center"],["Date","left"],["Type","center"],["Payment","right"],["Balance","right"]].map(([h, align]) => (
                  {h}
                ))}
              
            
            
              {schedule.map((r, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #f0f0f0" }}>
                  {r.isDP ? "—" : r.isFee ? "" : r.pmtNum}
                  {fmtDate(r.date)}
                  
                    {r.type}
                  
                  <td style={{ padding: "7px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: r.type === "Final" ? 700 : 400 }}>{fmt(r.payment)}
                  <td style={{ padding: "7px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: r.balance === 0 ? "#16a34a" : "#222", fontWeight: r.balance === 0 ? 700 : 400 }}>{fmt(r.balance)}
                
              ))}
            
          
        

        
          
            Total Payments
            {debtPayments.length}
          
          
            Estimated Payoff Date
            {payoffRow ? fmtDate(payoffRow.date) : "—"}
          
        
      </>)}
    
  );
}