import dotenv from "dotenv";
import path from "path";

dotenv.config();
import app from "./app.ts";

const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>{
  console.log(`Server running on port ${PORT}`);
});