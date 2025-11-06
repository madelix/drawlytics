import express from "express"; import cors from "cors";
const app = express(); app.use(cors()); app.use(express.json());
app.get("/api/health",(req,res)=>res.json({ok:true}));
app.get("/api/frequency",(req,res)=>res.json({numbers:[1,2,3,4,5,6,7],counts:[12,9,14,7,5,11,10]}));
app.get("/", (req, res) => res.send("Drawlytics API is running"));
app.listen(3000,()=>console.log("API http://localhost:3000"));
