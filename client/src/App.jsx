import { useEffect, useState } from "react";
export default function App() {
  const [health, setHealth] = useState(null);
  const [freq, setFreq] = useState(null);
  useEffect(() => {
    fetch("/api/health").then(r=>r.json()).then(setHealth);
    fetch("/api/frequency").then(r=>r.json()).then(setFreq);
  }, []);
  return (
    <div style={{fontFamily:"system-ui", padding:20, maxWidth:740, margin:"0 auto"}}>
      <h1>Drawlytics (MVP)</h1>
      <p>API status: {health ? JSON.stringify(health) : "…checking"}</p>
      <h2 style={{marginTop:16}}>Demo Frequency</h2>
      {!freq ? <p>Loading…</p> : (
        <ul>{freq.numbers.map((n,i)=><li key={n}>Number {n}: {freq.counts[i]}</li>)}</ul>
      )}
      <p style={{opacity:.7,fontSize:12,marginTop:24}}>
        For educational & entertainment use only. No ticket sales or betting.
      </p>
    </div>
  );
}
