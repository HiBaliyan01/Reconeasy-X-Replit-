// server/src/index.ts
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import rateCards from "./routes/rateCards";

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use("/api", rateCards);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`[express] serving on port ${port}`));
